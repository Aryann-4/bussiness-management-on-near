import React, { useEffect, useMemo, useState } from "react";
import type {
  Customer,
  Dashboard,
  Invoice,
  InvoiceItemInput,
  InvoiceStatus,
  Product,
} from "./types";
import * as demo from "./demoStore";
import {
  CONTRACT_ID,
  connectWallet,
  disconnectWallet,
  fetchDashboard,
  live,
  restoreWallet,
} from "./near";
import { formatDate, formatNear, nearToYocto, shortAccount } from "./money";
import "./styles.css";

type Mode = "demo" | "live";
type Tab = "overview" | "invoices" | "customers" | "products" | "settings";
type Toast = { kind: "success" | "error"; message: string } | null;

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "◎" },
  { id: "invoices", label: "Invoices", icon: "▤" },
  { id: "customers", label: "Customers", icon: "☺" },
  { id: "products", label: "Products", icon: "▦" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

const emptyLine = () => ({ description: "", quantity: "1", unit: "" });

export default function App() {
  const [mode, setMode] = useState<Mode>("demo");
  const [account, setAccount] = useState<string | null>(demo.DEMO_ACCOUNT);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [toast, setToast] = useState<Toast>(null);
  const [busy, setBusy] = useState(false);
  const [connecting, setConnecting] = useState(false);

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
      const saved = demo.loadDemo();
      setAccount(demo.DEMO_ACCOUNT);
      setDashboard(saved);
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
        // Wallet modal opened; the page will reload after authentication.
        return;
      }
      setAccount(accountId);
      await refreshLive(accountId);
      notify("success", `Connected to ${shortAccount(accountId)}`);
    } catch (error) {
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

  /** Runs a mutation in either mode, then keeps state in sync. */
  const run = async (label: string, action: {
    demo?: () => Dashboard;
    live?: () => Promise<unknown>;
  }) => {
    setBusy(true);
    try {
      if (mode === "demo") {
        if (action.demo) persistDemo(action.demo());
      } else {
        if (!action.live) {
          notify("error", "This action is not available on-chain");
          return;
        }
        if (!account) {
          notify("error", "Connect a NEAR wallet first");
          return;
        }
        await action.live();
        await refreshLive(account);
      }
      notify("success", label);
    } catch (error) {
      notify("error", error instanceof Error ? error.message : String(error));
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

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">◈</div>
          <div>
            <h1>NEAR Business Manager</h1>
            <p>On-chain operations for online businesses · {CONTRACT_ID}</p>
          </div>
        </div>
        <div className="top-actions">
          <span className="pill">
            <span className={mode === "live" ? "dot live" : "dot"} />
            {mode === "demo" ? "Demo workspace" : account ? shortAccount(account) : "Not connected"}
          </span>
          <button
            className="btn ghost small"
            onClick={() => switchMode(mode === "demo" ? "live" : "demo")}
          >
            {mode === "demo" ? "Switch to NEAR testnet" : "Switch to demo"}
          </button>
          {mode === "live" &&
            (account ? (
              <button className="btn small" onClick={disconnect}>
                Disconnect
              </button>
            ) : (
              <button className="btn primary small" onClick={connect} disabled={connecting}>
                {connecting ? "Connecting…" : "Connect wallet"}
              </button>
            ))}
        </div>
      </header>

      {mode === "live" && !account && (
        <div className="card" style={{ maxWidth: 560, margin: "60px auto", textAlign: "center" }}>
          <h2>Connect a NEAR testnet wallet</h2>
          <p className="sub">
            Live mode signs real transactions against <span className="mono">{CONTRACT_ID}</span>.
            Use a testnet account with a small NEAR balance.
          </p>
          <button className="btn primary" onClick={connect} disabled={connecting}>
            {connecting ? "Connecting…" : "Open wallet selector"}
          </button>
          <p className="muted" style={{ marginTop: 14, fontSize: "0.8rem" }}>
            Prefer a no-wallet experience? Switch back to the demo workspace — every feature works
            locally.
          </p>
        </div>
      )}

      {!(mode === "live" && !account) && !dashboard && (
        <Onboarding mode={mode} busy={busy} onCreate={createBusiness} />
      )}

      {!(mode === "live" && !account) && dashboard && (
        <div className="main-grid">
          <aside className="sidebar">
            {TABS.map((item) => (
              <button
                key={item.id}
                className={`nav-item ${tab === item.id ? "active" : ""}`}
                onClick={() => setTab(item.id)}
              >
                <span>{item.icon}</span>
                {item.label}
              </button>
            ))}
            <div className="card tight" style={{ marginTop: 8, background: "rgba(12,18,34,0.55)" }}>
              <div className="muted" style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Workspace
              </div>
              <div style={{ fontWeight: 700, marginTop: 4 }}>{dashboard.business.name}</div>
              <div className="mono muted">@{dashboard.business.handle || "business"}</div>
              <div style={{ fontSize: "0.76rem", marginTop: 8 }} className="muted">
                Tax {dashboard.business.tax_bps / 100}% · {dashboard.business.currency}
              </div>
            </div>
          </aside>

          <main className="stack" style={{ gap: 18 }}>
            {tab === "overview" && (
              <Overview dashboard={dashboard} stats={stats} onOpenInvoices={() => setTab("invoices")} />
            )}
            {tab === "invoices" && (
              <Invoices
                mode={mode}
                account={account}
                dashboard={dashboard}
                busy={busy}
                run={run}
              />
            )}
            {tab === "customers" && <Customers mode={mode} dashboard={dashboard} run={run} busy={busy} />}
            {tab === "products" && <Products mode={mode} dashboard={dashboard} run={run} busy={busy} />}
            {tab === "settings" && (
              <Settings
                mode={mode}
                dashboard={dashboard}
                run={run}
                busy={busy}
                onReset={() => {
                  demo.saveDemo(null);
                  setDashboard(null);
                  setTab("overview");
                }}
              />
            )}
          </main>
        </div>
      )}

      {toast && <div className={`toast ${toast.kind}`}>{toast.message}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------

function Onboarding({
  mode,
  busy,
  onCreate,
}: {
  mode: Mode;
  busy: boolean;
  onCreate: (input: {
    name: string;
    handle: string;
    email: string;
    currency: string;
    tax_bps: number;
  }) => void;
}) {
  const [form, setForm] = useState({
    name: "",
    handle: "",
    email: "",
    currency: "NEAR",
    tax: "15",
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    onCreate({
      name: form.name,
      handle: form.handle,
      email: form.email,
      currency: form.currency,
      tax_bps: Math.round(Number(form.tax || 0) * 100),
    });
  };

  return (
    <div className="hero">
      <div className="hero-copy">
        <span className="pill" style={{ marginBottom: 16 }}>
          <span className="dot" /> {mode === "demo" ? "Try the full product instantly" : "NEAR testnet"}
        </span>
        <h2>Run your online business from one on-chain dashboard.</h2>
        <p>
          Customers, products, invoices and payments — settled in NEAR. No spreadsheets, no
          forgotten renewals, no payment link stitching. Every invoice is verifiable, and money
          moves straight to your account.
        </p>
        <ul className="hero-points">
          <li><span className="check">✓</span> Create invoices with automatic tax calculation</li>
          <li><span className="check">✓</span> Get paid in NEAR with one-click settlement</li>
          <li><span className="check">✓</span> Track revenue, open invoices and outstanding balances</li>
          <li><span className="check">✓</span> Demo mode stores everything locally — no wallet needed</li>
        </ul>
        {mode === "demo" && (
          <button
            className="btn"
            onClick={() => {
              const seeded = seedSample();
              setForm({
                name: seeded.business.name,
                handle: seeded.business.handle,
                email: seeded.business.email,
                currency: seeded.business.currency,
                tax: String(seeded.business.tax_bps / 100),
              });
              demo.saveDemo(seeded);
              window.location.reload();
            }}
          >
            Load a sample workspace
          </button>
        )}
      </div>

      <form className="card" onSubmit={submit}>
        <h2>Create your business</h2>
        <p className="sub">
          This is your workspace identity. You can change it later in Settings.
        </p>
        <div className="field">
          <label>Business name</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Acme Studio"
            required
          />
        </div>
        <div className="form-row">
          <div className="field">
            <label>Handle</label>
            <input
              value={form.handle}
              onChange={(e) => setForm({ ...form, handle: e.target.value })}
              placeholder="acme"
            />
          </div>
          <div className="field">
            <label>Currency</label>
            <input
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
              placeholder="NEAR"
            />
          </div>
        </div>
        <div className="form-row">
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="billing@acme.com"
            />
          </div>
          <div className="field">
            <label>Tax rate (%)</label>
            <input
              type="number"
              min="0"
              max="50"
              step="0.1"
              value={form.tax}
              onChange={(e) => setForm({ ...form, tax: e.target.value })}
            />
          </div>
        </div>
        <div className="actions">
          <button className="btn primary" type="submit" disabled={busy}>
            {busy ? "Creating…" : "Create business"}
          </button>
          <span className="muted" style={{ fontSize: "0.78rem" }}>
            {mode === "demo" ? "Stored in your browser" : "Signed on NEAR testnet"}
          </span>
        </div>
      </form>
    </div>
  );
}

function seedSample(): Dashboard {
  let d = demo.createBusiness({
    name: "Acme Studio",
    handle: "acme",
    email: "billing@acme.studio",
    currency: "NEAR",
    tax_bps: 1500,
  });
  d = demo.addCustomer(d, "Ada Lovelace", "ada@example.com");
  d = demo.addCustomer(d, "Grace Hopper", "grace@example.com");
  d = demo.addCustomer(d, "Linus Torvalds", "linus@example.com");
  d = demo.addProduct(d, "Brand identity sprint", nearToYocto("180"));
  d = demo.addProduct(d, "Landing page build", nearToYocto("95"));
  d = demo.addProduct(d, "Monthly support retainer", nearToYocto("40"));

  const first = demo.createInvoice(
    d,
    1,
    [
      { description: "Brand identity sprint", quantity: 1, unit_price: nearToYocto("180") },
      { description: "Landing page build", quantity: 1, unit_price: nearToYocto("95") },
    ],
    21,
  );
  d = demo.setStatus(first.dashboard, first.invoice.id, "Sent");
  d = demo.payInvoice(d, first.invoice.id);

  const second = demo.createInvoice(
    d,
    2,
    [{ description: "Monthly support retainer", quantity: 2, unit_price: nearToYocto("40") }],
    14,
  );
  d = demo.setStatus(second.dashboard, second.invoice.id, "Sent");

  const third = demo.createInvoice(
    d,
    3,
    [{ description: "Landing page build", quantity: 1, unit_price: nearToYocto("95") }],
    30,
  );
  d = third.dashboard;

  return d;
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

function Overview({
  dashboard,
  stats,
  onOpenInvoices,
}: {
  dashboard: Dashboard;
  stats: ReturnType<typeof demo.statsOf>;
  onOpenInvoices: () => void;
}) {
  const recent = [...dashboard.invoices].sort((a, b) => b.id - a.id).slice(0, 5);
  const customerName = (id: number) =>
    dashboard.customers.find((c) => c.id === id)?.name ?? `Customer #${id}`;

  return (
    <>
      <div className="grid cols-4">
        <Stat label="Revenue" value={formatNear(stats.revenue, dashboard.business.currency)} hint="paid invoices" />
        <Stat label="Outstanding" value={formatNear(stats.outstanding, dashboard.business.currency)} hint={`${stats.open_invoices} open invoice${stats.open_invoices === 1 ? "" : "s"}`} />
        <Stat label="Customers" value={String(stats.customers)} hint="active relationships" />
        <Stat label="Invoices" value={String(stats.invoices)} hint={`${stats.paid_invoices} paid`} />
      </div>

      <div className="card">
        <div className="row-between">
          <div>
            <h2>Recent invoices</h2>
            <p className="sub">The latest activity across your business.</p>
          </div>
          <button className="btn small" onClick={onOpenInvoices}>
            View all
          </button>
        </div>
        {recent.length === 0 ? (
          <div className="empty">No invoices yet. Create your first one from the Invoices tab.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Status</th>
                <th>Due</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((invoice) => (
                <tr key={invoice.id}>
                  <td className="mono">#{String(invoice.id).padStart(4, "0")}</td>
                  <td>{customerName(invoice.customer_id)}</td>
                  <td>{formatNear(invoice.total, dashboard.business.currency)}</td>
                  <td><span className={`badge ${invoice.status}`}>{invoice.status}</span></td>
                  <td className="muted">{formatDate(invoice.due_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h2>Top products</h2>
          <p className="sub">Your catalogue at a glance.</p>
          {dashboard.products.length === 0 ? (
            <div className="empty">Add products or services to speed up invoicing.</div>
          ) : (
            <div className="stack">
              {dashboard.products.slice(0, 5).map((product) => (
                <div key={product.id} className="row-between" style={{ borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
                  <span>{product.name}</span>
                  <span className="muted mono">{formatNear(product.price, dashboard.business.currency)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card">
          <h2>How settlement works</h2>
          <p className="sub">Every payment is a NEAR transaction.</p>
          <ol className="hero-points" style={{ paddingLeft: 4 }}>
            <li><span className="check">1</span> Create an invoice for a customer.</li>
            <li><span className="check">2</span> Share the invoice ID.</li>
            <li><span className="check">3</span> The customer pays the exact total in NEAR.</li>
            <li><span className="check">4</span> Funds land in your account; revenue updates.</li>
          </ol>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      <div className="hint">{hint}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

function Invoices({
  mode,
  account,
  dashboard,
  busy,
  run,
}: {
  mode: Mode;
  account: string | null;
  dashboard: Dashboard;
  busy: boolean;
  run: (
    label: string,
    action: { demo?: () => Dashboard; live?: () => Promise<unknown> },
  ) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState<number | "">("");
  const [dueDays, setDueDays] = useState("14");
  const [items, setItems] = useState([emptyLine(), emptyLine()]);
  const [viewing, setViewing] = useState<Invoice | null>(null);

  const customerName = (id: number) =>
    dashboard.customers.find((c) => c.id === id)?.name ?? `Customer #${id}`;

  const preview = useMemo(() => {
    let subtotal = 0n;
    for (const item of items) {
      try {
        subtotal += BigInt(nearToYocto(item.unit || "0")) * BigInt(Math.max(0, Number(item.quantity) || 0));
      } catch {
        /* ignore invalid input in preview */
      }
    }
    const tax = (subtotal * BigInt(dashboard.business.tax_bps)) / 10_000n;
    return { subtotal, tax, total: subtotal + tax };
  }, [items, dashboard.business.tax_bps]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (customerId === "") return;
    const lines: InvoiceItemInput[] = items
      .filter((item) => item.description.trim() && item.unit)
      .map((item) => ({
        description: item.description,
        quantity: Math.max(1, Number(item.quantity) || 1),
        unit_price: nearToYocto(item.unit),
      }));

    await run(`Invoice created for ${customerName(customerId)}`, {
      demo: () => demo.createInvoice(dashboard, customerId, lines, Number(dueDays) || 0).dashboard,
      live: () => live.createInvoice(customerId, lines, Number(dueDays) || 0),
    });
    setItems([emptyLine(), emptyLine()]);
    setOpen(false);
  };

  const updateStatus = (invoice: Invoice, status: InvoiceStatus) =>
    run(`Invoice #${invoice.id} marked ${status}`, {
      demo: () => demo.setStatus(dashboard, invoice.id, status),
      live: () => live.setStatus(invoice.id, status),
    });

  const pay = (invoice: Invoice) =>
    run(`Invoice #${invoice.id} paid`, {
      demo: () => demo.payInvoice(dashboard, invoice.id),
      live: async () => {
        if (!account) throw new Error("Connect a NEAR wallet first");
        await live.payInvoice(account, invoice.id, invoice.total);
      },
    });

  return (
    <>
      <div className="card">
        <div className="row-between">
          <div>
            <h2>Invoices</h2>
            <p className="sub">
              {dashboard.invoices.length} invoice{dashboard.invoices.length === 1 ? "" : "s"} ·{" "}
              {mode === "demo" ? "demo workspace" : "on-chain"}
            </p>
          </div>
          <button className="btn primary" onClick={() => setOpen((v) => !v)}>
            {open ? "Close" : "+ New invoice"}
          </button>
        </div>

        {open && (
          <form onSubmit={submit} className="stack" style={{ marginBottom: 22 }}>
            {dashboard.customers.length === 0 ? (
              <div className="empty">Add a customer first from the Customers tab.</div>
            ) : (
              <>
                <div className="form-row">
                  <div className="field">
                    <label>Customer</label>
                    <select value={customerId} onChange={(e) => setCustomerId(Number(e.target.value))} required>
                      <option value="">Select a customer</option>
                      {dashboard.customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Due in (days)</label>
                    <input type="number" min="0" value={dueDays} onChange={(e) => setDueDays(e.target.value)} />
                  </div>
                </div>

                <div>
                  <label>Line items</label>
                  <div className="line-items">
                    {items.map((item, index) => (
                      <div className="line-item" key={index}>
                        <input
                          placeholder="Description"
                          value={item.description}
                          onChange={(e) => {
                            const next = [...items];
                            next[index] = { ...item, description: e.target.value };
                            setItems(next);
                          }}
                        />
                        <input
                          type="number"
                          min="1"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => {
                            const next = [...items];
                            next[index] = { ...item, quantity: e.target.value };
                            setItems(next);
                          }}
                        />
                        <input
                          placeholder="Unit price (NEAR)"
                          value={item.unit}
                          onChange={(e) => {
                            const next = [...items];
                            next[index] = { ...item, unit: e.target.value };
                            setItems(next);
                          }}
                        />
                        <button
                          type="button"
                          className="btn ghost remove"
                          onClick={() => setItems(items.filter((_, i) => i !== index))}
                          disabled={items.length === 1}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                  <button type="button" className="btn small" style={{ marginTop: 10 }} onClick={() => setItems([...items, emptyLine()])}>
                    + Add line
                  </button>
                </div>

                <div className="totals">
                  <div className="row"><span>Subtotal</span><span>{formatNear(preview.subtotal.toString())}</span></div>
                  <div className="row"><span>Tax ({dashboard.business.tax_bps / 100}%)</span><span>{formatNear(preview.tax.toString())}</span></div>
                  <div className="row total"><span>Total</span><span>{formatNear(preview.total.toString(), dashboard.business.currency)}</span></div>
                </div>

                <div className="actions">
                  <button className="btn primary" type="submit" disabled={busy || customerId === ""}>
                    {busy ? "Creating…" : "Create invoice"}
                  </button>
                </div>
              </>
            )}
          </form>
        )}

        {dashboard.invoices.length === 0 ? (
          <div className="empty">No invoices yet.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Status</th>
                <th>Due</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {[...dashboard.invoices].reverse().map((invoice) => (
                <tr key={invoice.id}>
                  <td className="mono">#{String(invoice.id).padStart(4, "0")}</td>
                  <td>{customerName(invoice.customer_id)}</td>
                  <td>{formatNear(invoice.total, dashboard.business.currency)}</td>
                  <td><span className={`badge ${invoice.status}`}>{invoice.status}</span></td>
                  <td className="muted">{formatDate(invoice.due_date)}</td>
                  <td>
                    <div className="inline" style={{ justifyContent: "flex-end" }}>
                      <button className="btn ghost small" onClick={() => setViewing(invoice)}>
                        View
                      </button>
                      {invoice.status === "Draft" && (
                        <button className="btn small" onClick={() => updateStatus(invoice, "Sent")} disabled={busy}>
                          Send
                        </button>
                      )}
                      {invoice.status !== "Paid" && invoice.status !== "Cancelled" && (
                        <button className="btn primary small" onClick={() => pay(invoice)} disabled={busy}>
                          Pay
                        </button>
                      )}
                      {invoice.status !== "Paid" && invoice.status !== "Cancelled" && (
                        <button className="btn danger small" onClick={() => updateStatus(invoice, "Cancelled")} disabled={busy}>
                          Cancel
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {viewing && (
        <div className="card">
          <div className="row-between">
            <div>
              <h2>Invoice #{String(viewing.id).padStart(4, "0")}</h2>
              <p className="sub">
                {customerName(viewing.customer_id)} · issued {formatDate(viewing.created_at)} · due{" "}
                {formatDate(viewing.due_date)}
              </p>
            </div>
            <button className="btn ghost small" onClick={() => setViewing(null)}>
              Close
            </button>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Qty</th>
                <th>Unit</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {viewing.items.map((item, index) => (
                <tr key={index}>
                  <td>{item.description}</td>
                  <td>{item.quantity}</td>
                  <td>{formatNear(item.unit_price, dashboard.business.currency)}</td>
                  <td>{formatNear(item.amount, dashboard.business.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="totals">
            <div className="row"><span>Subtotal</span><span>{formatNear(viewing.subtotal, dashboard.business.currency)}</span></div>
            <div className="row"><span>Tax</span><span>{formatNear(viewing.tax, dashboard.business.currency)}</span></div>
            <div className="row total"><span>Total</span><span>{formatNear(viewing.total, dashboard.business.currency)}</span></div>
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

function Customers({
  mode,
  dashboard,
  run,
  busy,
}: {
  mode: Mode;
  dashboard: Dashboard;
  run: (label: string, action: { demo?: () => Dashboard; live?: () => Promise<unknown> }) => Promise<void>;
  busy: boolean;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    await run(`Customer ${name} added`, {
      demo: () => demo.addCustomer(dashboard, name, email),
      live: () => live.addCustomer(name, email),
    });
    setName("");
    setEmail("");
  };

  const invoiceCount = (customer: Customer) =>
    dashboard.invoices.filter((invoice) => invoice.customer_id === customer.id).length;

  return (
    <>
      <form className="card" onSubmit={submit}>
        <h2>Add a customer</h2>
        <p className="sub">{mode === "demo" ? "Saved locally in this demo." : "Stored on NEAR testnet."}</p>
        <div className="form-row">
          <div className="field">
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Lovelace" required />
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ada@example.com" />
          </div>
        </div>
        <div className="actions">
          <button className="btn primary" type="submit" disabled={busy}>
            {busy ? "Adding…" : "Add customer"}
          </button>
        </div>
      </form>

      <div className="card">
        <h2>Customers</h2>
        <p className="sub">{dashboard.customers.length} total</p>
        {dashboard.customers.length === 0 ? (
          <div className="empty">No customers yet.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Invoices</th>
                <th>Added</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {dashboard.customers.map((customer) => (
                <tr key={customer.id}>
                  <td>{customer.name}</td>
                  <td className="muted">{customer.email || "—"}</td>
                  <td>{invoiceCount(customer)}</td>
                  <td className="muted">{formatDate(customer.created_at)}</td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      className="btn danger small"
                      disabled={busy}
                      onClick={() =>
                        run(`Customer ${customer.name} removed`, {
                          demo: () => demo.removeCustomer(dashboard, customer.id),
                          live: () => live.removeCustomer(customer.id),
                        })
                      }
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

function Products({
  mode,
  dashboard,
  run,
  busy,
}: {
  mode: Mode;
  dashboard: Dashboard;
  run: (label: string, action: { demo?: () => Dashboard; live?: () => Promise<unknown> }) => Promise<void>;
  busy: boolean;
}) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    await run(`Product ${name} added`, {
      demo: () => demo.addProduct(dashboard, name, nearToYocto(price)),
      live: () => live.addProduct(name, nearToYocto(price)),
    });
    setName("");
    setPrice("");
  };

  const toggle = (product: Product) =>
    run(`${product.name} ${product.active ? "archived" : "activated"}`, {
      demo: () => demo.toggleProduct(dashboard, product.id),
      live: () => live.toggleProduct(product),
    });

  const remove = (product: Product) =>
    run(`${product.name} removed`, {
      demo: () => demo.removeProduct(dashboard, product.id),
      live: () => live.removeProduct(product.id),
    });

  return (
    <>
      <form className="card" onSubmit={submit}>
        <h2>Add a product or service</h2>
        <p className="sub">Prices are in NEAR and used to speed up invoicing.</p>
        <div className="form-row">
          <div className="field">
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Landing page build" required />
          </div>
          <div className="field">
            <label>Price (NEAR)</label>
            <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="95" required />
          </div>
        </div>
        <div className="actions">
          <button className="btn primary" type="submit" disabled={busy}>
            {busy ? "Adding…" : "Add product"}
          </button>
          <span className="muted" style={{ fontSize: "0.78rem" }}>
            {mode === "demo" ? "Demo workspace" : "Signed on NEAR testnet"}
          </span>
        </div>
      </form>

      <div className="card">
        <h2>Catalogue</h2>
        <p className="sub">{dashboard.products.length} item{dashboard.products.length === 1 ? "" : "s"}</p>
        {dashboard.products.length === 0 ? (
          <div className="empty">No products yet.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Price</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {dashboard.products.map((product) => (
                <tr key={product.id}>
                  <td>{product.name}</td>
                  <td>{formatNear(product.price, dashboard.business.currency)}</td>
                  <td>
                    <span className={`badge ${product.active ? "Paid" : "Draft"}`}>
                      {product.active ? "Active" : "Archived"}
                    </span>
                  </td>
                  <td>
                    <div className="inline" style={{ justifyContent: "flex-end" }}>
                      <button className="btn small" onClick={() => toggle(product)} disabled={busy}>
                        {product.active ? "Archive" : "Activate"}
                      </button>
                      <button className="btn danger small" onClick={() => remove(product)} disabled={busy}>
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

function Settings({
  mode,
  dashboard,
  run,
  busy,
  onReset,
}: {
  mode: Mode;
  dashboard: Dashboard;
  run: (label: string, action: { demo?: () => Dashboard; live?: () => Promise<unknown> }) => Promise<void>;
  busy: boolean;
  onReset: () => void;
}) {
  const [form, setForm] = useState({
    name: dashboard.business.name,
    handle: dashboard.business.handle,
    email: dashboard.business.email,
    currency: dashboard.business.currency,
    tax: String(dashboard.business.tax_bps / 100),
  });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const input = {
      name: form.name,
      handle: form.handle,
      email: form.email,
      currency: form.currency,
      tax_bps: Math.round(Number(form.tax || 0) * 100),
    };
    await run("Business profile updated", {
      demo: () => ({ ...dashboard, business: { ...dashboard.business, ...input } }),
      live: () => live.updateBusiness(input),
    });
  };

  return (
    <>
      <form className="card" onSubmit={submit}>
        <h2>Business profile</h2>
        <p className="sub">
          {mode === "demo"
            ? "These details live in your browser for the demo."
            : "Updates are signed as a NEAR transaction."}
        </p>
        <div className="field">
          <label>Business name</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div className="form-row">
          <div className="field">
            <label>Handle</label>
            <input value={form.handle} onChange={(e) => setForm({ ...form, handle: e.target.value })} />
          </div>
          <div className="field">
            <label>Currency</label>
            <input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
          </div>
        </div>
        <div className="form-row">
          <div className="field">
            <label>Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="field">
            <label>Tax rate (%)</label>
            <input type="number" min="0" max="50" step="0.1" value={form.tax} onChange={(e) => setForm({ ...form, tax: e.target.value })} />
          </div>
        </div>
        <div className="actions">
          <button className="btn primary" type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>

      <div className="card">
        <h2>Contract</h2>
        <p className="sub">The on-chain program behind live mode.</p>
        <div className="stack">
          <div className="row-between">
            <span className="muted">Contract ID</span>
            <span className="mono">{CONTRACT_ID}</span>
          </div>
          <div className="row-between">
            <span className="muted">Network</span>
            <span>NEAR testnet</span>
          </div>
          <div className="row-between">
            <span className="muted">Mode</span>
            <span>{mode === "demo" ? "Demo (local state)" : "Live (signed transactions)"}</span>
          </div>
        </div>
      </div>

      {mode === "demo" && (
        <div className="card" style={{ borderColor: "rgba(251,113,133,0.3)" }}>
          <h2>Reset demo</h2>
          <p className="sub">Deletes the local workspace and returns to onboarding.</p>
          <button
            className="btn danger"
            onClick={() => {
              if (window.confirm("Delete the local demo workspace?")) onReset();
            }}
          >
            Delete demo data
          </button>
        </div>
      )}
    </>
  );
}
