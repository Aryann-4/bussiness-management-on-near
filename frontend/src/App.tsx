import { useEffect, useMemo, useState } from "react";
import type { Mode, Run, Tab, Toast } from "./appTypes";
import type { Dashboard } from "./types";
import * as demo from "./demoStore";
import { seedDashboard } from "./seed";
import {
  connectWallet,
  CONTRACT_ID,
  disconnectWallet,
  fetchDashboard,
  live,
  restoreWallet,
} from "./near";
import { shortAccount } from "./money";
import { Icon, type IconName } from "./components/Icon";
import { Logo } from "./components/Logo";
import { ToastView } from "./components/ui";
import Onboarding from "./pages/Onboarding";
import Overview from "./pages/Overview";
import Invoices from "./pages/Invoices";
import Customers from "./pages/Customers";
import Products from "./pages/Products";
import Settings from "./pages/Settings";
import "./styles.css";

const NAV: { id: Tab; label: string; icon: IconName }[] = [
  { id: "overview", label: "Overview", icon: "home" },
  { id: "invoices", label: "Invoices", icon: "invoice" },
  { id: "customers", label: "Customers", icon: "users" },
  { id: "products", label: "Products", icon: "box" },
  { id: "settings", label: "Settings", icon: "settings" },
];

type Theme = "light" | "dark";

function initialTheme(): Theme {
  const attr = document.documentElement.dataset.theme;
  if (attr === "light" || attr === "dark") return attr;
  const saved = localStorage.getItem("nbm:theme");
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function App() {
  const [mode, setMode] = useState<Mode>("demo");
  const [account, setAccount] = useState<string | null>(demo.DEMO_ACCOUNT);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [toast, setToast] = useState<Toast>(null);
  const [busy, setBusy] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem("nbm:theme", theme);
  }, [theme]);

  useEffect(() => {
    const savedMode = localStorage.getItem("nbm:mode");
    const boot = async () => {
      if (savedMode === "live") {
        setMode("live");
        try {
          const restored = await restoreWallet();
          if (restored) {
            setAccount(restored);
            await refreshLive(restored);
          } else {
            setAccount(null);
          }
        } catch {
          setAccount(null);
        }
        return;
      }
      const saved = demo.loadDemo();
      if (saved) setDashboard(saved);
    };
    boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(id);
  }, [toast]);

  const notify = (kind: "success" | "error", message: string) => setToast({ kind, message });

  const persistDemo = (next: Dashboard) => {
    setDashboard(next);
    demo.saveDemo(next);
  };

  const refreshLive = async (accountId: string) => {
    const remote = await fetchDashboard(accountId);
    setDashboard(remote);
  };

  const switchMode = async (next: Mode) => {
    if (next === mode) return;
    localStorage.setItem("nbm:mode", next);
    setMode(next);
    setTab("overview");
    if (next === "demo") {
      setAccount(demo.DEMO_ACCOUNT);
      setDashboard(demo.loadDemo());
      return;
    }
    setAccount(null);
    setDashboard(null);
    setConnecting(true);
    try {
      const restored = await restoreWallet();
      if (restored) {
        setAccount(restored);
        await refreshLive(restored);
      }
    } catch (error) {
      notify("error", error instanceof Error ? error.message : "Could not restore wallet");
    } finally {
      setConnecting(false);
    }
  };

  const connect = async () => {
    setConnecting(true);
    try {
      const accountId = await connectWallet();
      if (!accountId) {
        // The wallet modal is open; the page reloads after authentication.
        return;
      }
      setAccount(accountId);
      await refreshLive(accountId);
      notify("success", `Connected to ${shortAccount(accountId)}`);
    } catch (error) {
      console.error("Wallet connection failed", error);
      notify("error", error instanceof Error ? error.message : "Wallet connection failed");
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    try {
      await disconnectWallet();
    } catch {
      /* ignore */
    }
    setAccount(null);
    setDashboard(null);
  };

  const run: Run = async (label, action) => {
    setBusy(true);
    try {
      if (mode === "demo") {
        if (!action.demo) {
          notify("error", "This action is not available in demo mode");
          return false;
        }
        persistDemo(action.demo());
      } else {
        if (!action.live) {
          notify("error", "This action is not available on-chain");
          return false;
        }
        if (!account) {
          notify("error", "Connect a NEAR wallet first");
          return false;
        }
        await action.live();
        await refreshLive(account);
      }
      notify("success", label);
      return true;
    } catch (error) {
      notify("error", error instanceof Error ? error.message : String(error));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const stats = useMemo(() => demo.statsOf(dashboard), [dashboard]);

  const createBusiness = async (input: {
    name: string;
    handle: string;
    email: string;
    currency: string;
    tax_bps: number;
  }) => {
    await run("Business profile created", {
      demo: () => demo.createBusiness(input),
      live: async () => {
        if (!account) throw new Error("Connect a NEAR wallet first");
        await live.createBusiness(input);
        await refreshLive(account);
      },
    });
  };

  const loadSample = () => {
    const seeded = seedDashboard();
    demo.saveDemo(seeded);
    setDashboard(seeded);
    setTab("overview");
    notify("success", "Sample workspace loaded — explore away");
  };

  const resetDemo = () => {
    demo.saveDemo(null);
    setDashboard(null);
    setTab("overview");
    notify("success", "Demo workspace cleared");
  };

  return (
    <div className="app">
      <div className="orbs" aria-hidden="true">
        <span className="orb orb-a" />
        <span className="orb orb-b" />
        <span className="orb orb-c" />
      </div>

      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <Logo size={28} />
          </div>
          <div className="brand-text">
            <h1>NEAR Business Manager</h1>
            <p>Customers · Invoices · Payments</p>
          </div>
        </div>

        <div className="top-actions">
          <button
            className="icon-btn theme-toggle"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
            title={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
            aria-pressed={theme === "dark"}
          >
            <span className={`theme-icon ${theme}`}>
              <Icon name={theme === "light" ? "moon" : "sun"} size={17} />
            </span>
          </button>

          <span className={`mode-pill ${mode}`}>
            <span className="mode-dot" />
            {mode === "demo"
              ? "Demo workspace"
              : account
                ? shortAccount(account)
                : "Not connected"}
          </span>

          <button
            className="btn subtle small"
            onClick={() => switchMode(mode === "demo" ? "live" : "demo")}
          >
            <Icon name={mode === "demo" ? "wallet" : "home"} size={15} />
            {mode === "demo" ? "Try on NEAR" : "Back to demo"}
          </button>

          {mode === "live" &&
            (account ? (
              <button className="btn ghost small" onClick={disconnect}>
                Disconnect
              </button>
            ) : (
              <button className="btn primary small" onClick={connect} disabled={connecting}>
                {connecting ? "Connecting…" : "Connect wallet"}
              </button>
            ))}
        </div>
      </header>

      {mode === "demo" && (
        <div className="notice">
          <Icon name="info" size={17} />
          <p>
            <strong>You are in demo mode.</strong> Everything is saved in this browser — no wallet
            or blockchain needed.{" "}
            <button className="link" onClick={() => switchMode("live")}>
              Connect a testnet wallet
            </button>{" "}
            when you want to try real NEAR transactions.
          </p>
        </div>
      )}

      {mode === "live" && !account && (
        <div className="card connect-card">
          <div className="connect-icon">
            <Icon name="wallet" size={26} />
          </div>
          <h2>Connect a NEAR testnet wallet</h2>
          <p className="card-sub">
            Live mode signs real transactions against <span className="mono">{CONTRACT_ID}</span>.
            Use a testnet account with a little NEAR for fees.
          </p>
          <div className="connect-actions">
            <button className="btn primary" onClick={connect} disabled={connecting}>
              {connecting ? "Connecting…" : "Connect wallet"}
            </button>
            <button className="btn ghost" onClick={() => switchMode("demo")}>
              Back to demo
            </button>
          </div>
          <p className="hint">
            No wallet handy? The demo works exactly the same, just without real transactions.
          </p>
        </div>
      )}

      {!(mode === "live" && !account) && !dashboard && (
        <Onboarding mode={mode} busy={busy} onCreate={createBusiness} onSample={loadSample} />
      )}

      {!(mode === "live" && !account) && dashboard && (
        <div className="shell">
          <aside className="sidebar">
            <nav className="nav" aria-label="Sections">
              {NAV.map((item) => (
                <button
                  key={item.id}
                  className={`nav-item ${tab === item.id ? "active" : ""}`}
                  onClick={() => setTab(item.id)}
                  aria-current={tab === item.id ? "page" : undefined}
                >
                  <Icon name={item.icon} size={18} />
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>

            <div className="side-card">
              <div className="side-label">Current business</div>
              <div className="side-name">{dashboard.business.name}</div>
              <div className="side-handle">@{dashboard.business.handle || "business"}</div>
              <div className="side-meta">
                {dashboard.business.tax_bps / 100}% tax · {dashboard.business.currency}
              </div>
            </div>

            <div className="side-card soft">
              <div className="side-label">Contract</div>
              <div className="mono side-contract">{CONTRACT_ID}</div>
              <div className="side-meta">NEAR testnet</div>
            </div>
          </aside>

          <main className="main">
            <div className="page-transition" key={tab}>
              {tab === "overview" && (
                <Overview dashboard={dashboard} stats={stats} onNavigate={setTab} />
              )}
              {tab === "invoices" && (
                <Invoices
                  mode={mode}
                  account={account}
                  dashboard={dashboard}
                  busy={busy}
                  run={run}
                  onGoCustomers={() => setTab("customers")}
                />
              )}
              {tab === "customers" && (
                <Customers mode={mode} dashboard={dashboard} busy={busy} run={run} />
              )}
              {tab === "products" && (
                <Products mode={mode} dashboard={dashboard} busy={busy} run={run} />
              )}
              {tab === "settings" && (
                <Settings
                  mode={mode}
                  dashboard={dashboard}
                  busy={busy}
                  run={run}
                  onReset={resetDemo}
                />
              )}
            </div>
          </main>
        </div>
      )}

      <ToastView toast={toast} />
    </div>
  );
}
