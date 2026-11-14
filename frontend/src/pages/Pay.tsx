import { useEffect, useState } from "react";import {
  connectWallet,
  fetchDashboard,
  getFtMetadata,
  live,
  restoreWallet,
  type FtMetadata,
} from "../near";
import { guestSignIn, guestSignInAvailable, guestSignOut } from "../guest";
import { formatDate, formatNear, formatToken, shortAccount, totalToTokenUnits } from "../money";
import { Icon } from "../components/Icon";
import { Logo } from "../components/Logo";
import { StatusBadge } from "../components/ui";
import IntentsCheckout from "../components/IntentsCheckout";
import type { Business, Invoice } from "../types";
/**
 * Customer-facing payment page, opened via a shareable link:
 *   ?pay=<business_owner_account>:<invoice_id>
 *
 * The connected wallet (the customer) signs a real NEAR transaction calling
 * pay_invoice with the exact invoice total attached as deposit. The contract
 * forwards the deposit to the business owner.
 */
export default function Pay({
  ownerId,
  invoiceId,
}: {
  ownerId: string;
  invoiceId: number;
}) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [guestChoice, setGuestChoice] = useState<"wallet" | "google">("wallet");
  const [guestBusy, setGuestBusy] = useState(false);
  const [guestBusyError, setGuestBusyError] = useState<string | null>(null);
  const [guestPublicKey, setGuestPublicKey] = useState<string | null>(null);
  const [acceptedToken, setAcceptedToken] = useState<{ account: string; decimals: number } | null>(
    null,
  );
  const [tokenMeta, setTokenMeta] = useState<FtMetadata | null>(null);
  const [payKind, setPayKind] = useState<"near" | "token" | "intents">("near");

  const signInWithGoogle = async () => {
    setGuestBusy(true);
    setGuestBusyError(null);
    try {
      const session = await guestSignIn();
      setGuestPublicKey(session.publicKey);
    } catch (e) {
      setGuestBusyError(
        e instanceof Error ? e.message : "Google sign-in didn't complete.",
      );
    } finally {
      setGuestBusy(false);
    }
  };

  const signOutGuest = async () => {
    try {
      await guestSignOut();
    } catch {
      /* ignore */
    }
    setGuestPublicKey(null);
    setGuestBusyError(null);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    // One RPC call gives us the invoice, business profile and accepted token.
    fetchDashboard(ownerId)
      .then((dash) => {
        if (cancelled) return;
        const inv = dash?.invoices.find((candidate) => candidate.id === invoiceId) ?? null;
        setInvoice(inv);
        setBusiness(dash?.business ?? null);
        if (dash?.accepted_token) {
          setAcceptedToken(dash.accepted_token);
          getFtMetadata(dash.accepted_token.account).then((meta) => {
            if (!cancelled) setTokenMeta(meta);
          });
        }
        setLoading(false);
        if (!inv) {
          setError("This payment link is invalid or the invoice was removed.");
        }
      })
      .catch((_) => {
        if (cancelled) return;
        setLoading(false);
        setError("Could not load this invoice. Please try again in a moment.");
      });

    return () => {
      cancelled = true;
    };
  }, [ownerId, invoiceId]);

  // Restore a previously connected wallet without blocking the first render.
  useEffect(() => {
    let cancelled = false;
    restoreWallet().then((acc) => {
      if (!cancelled && acc) setAccount(acc);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const pay = async () => {
    if (!invoice) return;
    setBusy(true);
    setError(null);
    try {
      if (!account) {
        const acc = await connectWallet();
        if (!acc) {
          setAccount(null);
          setError("Connect a NEAR wallet to pay.");
          return;
        }
        setAccount(acc);
      }
      let result;
      if (payKind === "token" && acceptedToken) {
        const amount = totalToTokenUnits(invoice.total, acceptedToken.decimals);
        result = await live.payInvoiceFt(ownerId, invoiceId, acceptedToken.account, amount);
      } else {
        result = await live.payInvoice(ownerId, invoiceId, invoice.total);
      }
      const hash =
        (result as any)?.transaction?.hash ??
        (result as any)?.transactionHash ??
        (result as any)?.[0]?.transaction?.hash ??
        null;
      setTxHash(hash);
      setInvoice({ ...invoice, status: "Paid", paid_at: Date.now() * 1_000_000 });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      // The wallet redirects for signing; a user dismissal lands here too.
      if (!/cancel|dismiss|reject/i.test(message)) {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  };

  const paid = txHash !== null || invoice?.status === "Paid";
  const tokenSymbol = tokenMeta?.symbol ?? "tokens";
  const tokenAmount = acceptedToken
    ? totalToTokenUnits(invoice?.total ?? "0", acceptedToken.decimals)
    : "0";
  const payLabel = invoice
    ? payKind === "token" && acceptedToken
      ? formatToken(tokenAmount, acceptedToken.decimals, tokenSymbol)
      : formatNear(invoice.total, business?.currency)
    : "";

  return (
    <div className="app pay-page">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <Logo size={28} />
          </div>
          <div className="brand-text">
            <h1>NEAR Business Manager</h1>
            <p>Secure invoice payment</p>
          </div>
        </div>
        <a className="btn ghost small" href="./">
          <Icon name="home" size={15} />
          Go to app
        </a>
      </header>

      <main className="pay-wrap">
        {loading && (
          <div className="card pay-card">
            <div className="empty">
              <div className="empty-icon">
                <Icon name="invoice" size={22} />
              </div>
              <div className="empty-title">Loading invoice…</div>
            </div>
          </div>
        )}

        {!loading && error && !invoice && (
          <div className="card pay-card">
            <div className="card-head">
              <h2>Payment link problem</h2>
              <p className="card-sub">{error}</p>
            </div>
            <a className="btn primary" href="./">
              <Icon name="home" size={16} />
              Go to app
            </a>
          </div>
        )}

        {!loading && invoice && (
          <div className="card pay-card">
            <div className="pay-head">
              <div className="pay-avatar" aria-hidden="true">
                {(business?.name ?? ownerId).trim().charAt(0).toUpperCase()}
              </div>
              <div>
                <h2>{business?.name ?? "Invoice payment"}</h2>
                <p className="card-sub">
                  Invoice #{String(invoice.id).padStart(4, "0")} ·{" "}
                  {account ? `Paying from ${shortAccount(account)}` : "Connect your wallet to pay"}
                </p>
              </div>
            </div>

            <dl className="info-list pay-info">
              <div>
                <dt>Business</dt>
                <dd>{business?.name ?? ownerId}</dd>
              </div>
              <div>
                <dt>Due</dt>
                <dd>{formatDate(invoice.due_date)}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  <StatusBadge status={invoice.status} />
                </dd>
              </div>
            </dl>

            <div className="table-wrap pay-table">
              <table className="table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Qty</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item, index) => (
                    <tr key={index}>
                      <td data-label="Description">{item.description}</td>
                      <td data-label="Qty">{item.quantity}</td>
                      <td data-label="Amount">{formatNear(item.amount, business?.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="totals">
              <div className="summary-row">
                <span>Subtotal</span>
                <span>{formatNear(invoice.subtotal, business?.currency)}</span>
              </div>
              <div className="summary-row">
                <span>Tax</span>
                <span>{formatNear(invoice.tax, business?.currency)}</span>
              </div>
              <div className="summary-row total">
                <span>Total due</span>
                <span className="amount-pop">{formatNear(invoice.total, business?.currency)}</span>
              </div>
            </div>

            {error && (
              <p className="form-error" style={{ marginTop: 14 }}>
                <Icon name="info" size={15} />
                {error}
              </p>
            )}

            {paid ? (
              <div className="pay-success" role="status">
                <div className="check-icon">
                  <Icon name="check" size={20} />
                </div>
                <div>
                  <strong>Payment submitted</strong>
                  {txHash && (
                    <span className="pay-success-sub">
                      Transaction{" "}
                      <a
                        href={`https://testnet.nearblocks.io/tx/${txHash}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {shortAccount(txHash)}
                      </a>
                    </span>
                  )}
                  {!txHash && (
                    <span className="pay-success-sub">Thank you — the invoice is marked paid.</span>
                  )}
                </div>
              </div>
            ) : invoice.status === "Cancelled" ? (
              <div className="pay-cancelled">
                <Icon name="info" size={18} />
                This invoice has been cancelled by the business and can no longer be paid.
              </div>
            ) : (
              <>
                <div className="token-picker" role="radiogroup" aria-label="Payment currency">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={payKind === "near"}
                    className={`checkout-tab ${payKind === "near" ? "active" : ""}`}
                    onClick={() => setPayKind("near")}
                  >
                    <Icon name="wallet" size={14} />
                    NEAR
                  </button>
                  {acceptedToken && (
                    <button
                      type="button"
                      role="radio"
                      aria-checked={payKind === "token"}
                      className={`checkout-tab ${payKind === "token" ? "active" : ""}`}
                      onClick={() => setPayKind("token")}
                    >
                      <Icon name="card" size={14} />
                      {tokenSymbol}
                    </button>
                  )}
                  <button
                    type="button"
                    role="radio"
                    aria-checked={payKind === "intents"}
                    className={`checkout-tab ${payKind === "intents" ? "active" : ""}`}
                    onClick={() => setPayKind("intents")}
                  >
                    <Icon name="globe" size={14} />
                    Any chain
                  </button>
                </div>

                {payKind !== "intents" && (<><div
                  className="checkout-toggle"
                  role="tablist"
                  aria-label="Checkout method"
                >
                  <button
                    role="tab"
                    aria-selected={guestChoice === "wallet"}
                    className={`checkout-tab ${guestChoice === "wallet" ? "active" : ""}`}
                    onClick={() => setGuestChoice("wallet")}
                  >
                    <Icon name="wallet" size={14} />
                    NEAR wallet
                  </button>
                  <button
                    role="tab"
                    aria-selected={guestChoice === "google"}
                    className={`checkout-tab ${guestChoice === "google" ? "active" : ""}`}
                    onClick={() => setGuestChoice("google")}
                  >
                    <Icon name="users" size={14} />
                    Sign in with Google
                  </button>
                </div>

                {guestChoice === "google" ? (
                  guestPublicKey ? (
                    <div className="guest-panel">
                      <div className="guest-head">
                        <span className="guest-avatar" aria-hidden="true">
                          ✓
                        </span>
                        <div>
                          <strong>Google sign-in complete</strong>
                          <span className="guest-key" title={guestPublicKey}>
                            {guestPublicKey.slice(0, 24)}…
                          </span>
                        </div>
                      </div>
                      <p className="hint" style={{ margin: "8px 0" }}>
                        Your derived NEAR key is ready. Universal accounts aren&apos;t
                        supported by the browser SDK yet, so the final signature is
                        produced by your wallet instead:
                      </p>
                      <button className="btn primary block" onClick={pay} disabled={busy}>
                        <Icon name="card" size={16} />
                        {busy ? "Waiting for wallet…" : `Connect wallet & pay ${payLabel}`}
                      </button>
                      <button className="btn ghost block" onClick={signOutGuest} style={{ marginTop: 8 }}>
                        Switch account
                      </button>
                    </div>
                  ) : guestSignInAvailable() ? (
                    <div className="guest-panel">
                      <p className="guest-lead">
                        Sign in with an existing Google account to pay without setting up a
                        wallet app. You&apos;ll confirm the payment with a single tap.
                      </p>
                      <button
                        className="btn primary block"
                        onClick={signInWithGoogle}
                        disabled={guestBusy}
                      >
                        <Icon name="users" size={16} />
                        {guestBusy ? "Opening Google…" : "Continue with Google"}
                      </button>
                      {guestBusyError && (
                        <p className="form-error" style={{ marginTop: 8 }}>
                          <Icon name="info" size={14} />
                          {guestBusyError}
                        </p>
                      )}
                      <p className="hint" style={{ marginTop: 10 }}>
                        Powered by NEAR Auth (testnet). No password or seed phrase is
                        shared with this site — keys are secured by MPC.
                      </p>
                    </div>
                  ) : (
                    <div className="guest-panel">
                      <p className="guest-lead">
                        Google sign-in needs the NEAR Auth testnet callback origin, which
                        the shared client only allows on <span className="mono">localhost:3000</span>.
                      </p>
                      <p className="guest-lead" style={{ marginTop: 6 }}>
                        To try it here, run the app locally on port 3000 (the default
                        <code> npm run dev </code>) and open this same payment link — the tab will
                        work there. On other origins (including this deployed site) pop-ups
                        can&apos;t be authorized.
                      </p>
                      <button
                        className="btn primary block"
                        style={{ marginTop: 12 }}
                        onClick={() => setGuestChoice("wallet")}
                      >
                        <Icon name="wallet" size={16} />
                        Pay with NEAR wallet instead
                      </button>
                    </div>
                  )
                ) : (
                  <button
                    className="btn primary block pay-submit"
                    onClick={pay}
                    disabled={busy}
                  >
                    <Icon name="card" size={17} />
                    {busy
                      ? "Waiting for wallet…"
                      : account
                        ? `Pay ${payLabel}`
                        : "Connect wallet & pay"}
                  </button>
                )}
                </>)}
              </>
            )}

            {payKind === "intents" && invoice && (
              <IntentsCheckout ownerId={ownerId} totalYocto={invoice.total} />
            )}

            <p className="hint center" style={{ marginTop: 12 }}>
              {payKind === "intents" ? (
                <>
                  Cross-chain payments settle through NEAR Intents — the business
                  receives the exact invoice total on NEAR, no bridging steps needed.
                </>
              ) : payKind === "token" && acceptedToken ? (
                <>
                  Paying sends <span className="mono">{payLabel}</span>{" "}
                  (<span className="mono">{acceptedToken.account}</span>) to{" "}
                  <span className="mono">{ownerId}</span> via{" "}
                  <span className="mono">near-business-manager.testnet</span>.
                </>
              ) : (
                <>
                  Paying sends NEAR{" "}
                  <span className="mono">{formatNear(invoice.total, business?.currency)}</span> to{" "}
                  <span className="mono">{ownerId}</span> via{" "}
                  <span className="mono">near-business-manager.testnet</span>.
                </>
              )}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
