import { useEffect, useState } from "react";
import {
  connectWallet,
  getBusiness,
  getInvoice,
  live,
  restoreWallet,
} from "../near";
import { guestSignIn, guestSignOut } from "../guest";
import { shortAccount } from "../money";
import { formatDate, formatNear } from "../money";
import { Icon } from "../components/Icon";
import { Logo } from "../components/Logo";
import { StatusBadge } from "../components/ui";
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

    Promise.allSettled([
      getInvoice(ownerId, invoiceId),
      getBusiness(ownerId),
      restoreWallet(),
    ]).then(([invoiceResult, businessResult, accountResult]) => {
      if (cancelled) return;
      const inv =
        invoiceResult.status === "fulfilled" ? invoiceResult.value : null;
      const biz =
        businessResult.status === "fulfilled" ? businessResult.value : null;
      const acc =
        accountResult.status === "fulfilled" ? accountResult.value : null;

      setInvoice(inv);
      setBusiness(biz);
      setAccount(acc);
      setLoading(false);

      if (!inv) {
        setError("This payment link is invalid or the invoice was removed.");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [ownerId, invoiceId]);

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
      const result = await live.payInvoice(ownerId, invoiceId, invoice.total);
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
                <div
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
                        {busy ? "Waiting for wallet…" : `Connect wallet & pay ${formatNear(invoice.total, business?.currency)}`}
                      </button>
                      <button className="btn ghost block" onClick={signOutGuest} style={{ marginTop: 8 }}>
                        Switch account
                      </button>
                    </div>
                  ) : (
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
                        ? `Pay ${formatNear(invoice.total, business?.currency)}`
                        : "Connect wallet & pay"}
                  </button>
                )}
              </>
            )}

            <p className="hint center" style={{ marginTop: 12 }}>
              Paying sends NEAR{" "}
              <span className="mono">{formatNear(invoice.total, business?.currency)}</span> to{" "}
              <span className="mono">{ownerId}</span> via{" "}
              <span className="mono">near-business-manager.testnet</span>.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
