import { useState } from "react";
import type { Mode, Run } from "../appTypes";
import { Icon } from "../components/Icon";
import { CONTRACT_ID } from "../near";
import { live } from "../near";
import type { Dashboard } from "../types";

export default function Settings({
  mode,
  dashboard,
  busy,
  run,
  onReset,
}: {
  mode: Mode;
  dashboard: Dashboard;
  busy: boolean;
  run: Run;
  onReset: () => void;
}) {
  const [form, setForm] = useState({
    name: dashboard.business.name,
    handle: dashboard.business.handle,
    email: dashboard.business.email,
    currency: dashboard.business.currency,
    tax: String(dashboard.business.tax_bps / 100),
  });
  const [saved, setSaved] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const input = {
      name: form.name.trim(),
      handle: form.handle.trim().toLowerCase(),
      email: form.email.trim(),
      currency: form.currency.trim().toUpperCase() || "NEAR",
      tax_bps: Math.round(Number(form.tax || 0) * 100),
    };
    const ok = await run("Business profile updated", {
      demo: () => ({ ...dashboard, business: { ...dashboard.business, ...input } }),
      live: () => live.updateBusiness(input),
    });
    if (ok) {
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p className="page-sub">Change how your business appears on invoices.</p>
        </div>
      </div>

      <form className="card" onSubmit={submit}>
        <div className="card-head">
          <h2>Business details</h2>
          <p className="card-sub">
            {mode === "demo"
              ? "These details are stored in your browser for the demo."
              : "Updates are signed as a real NEAR transaction."}
          </p>
        </div>

        <div className="field">
          <label htmlFor="settings-name">Business name</label>
          <input
            id="settings-name"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            required
          />
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="settings-handle">Handle</label>
            <input
              id="settings-handle"
              value={form.handle}
              onChange={(event) => setForm({ ...form, handle: event.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="settings-email">Billing email</label>
            <input
              id="settings-email"
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
          </div>
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="settings-currency">Currency label</label>
            <input
              id="settings-currency"
              value={form.currency}
              onChange={(event) => setForm({ ...form, currency: event.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="settings-tax">Tax rate (%)</label>
            <input
              id="settings-tax"
              type="number"
              min="0"
              max="50"
              step="0.1"
              value={form.tax}
              onChange={(event) => setForm({ ...form, tax: event.target.value })}
            />
            <p className="hint">Applies to new invoices only.</p>
          </div>
        </div>

        <div className="form-foot">
          <button className="btn primary" type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </button>
          {saved && (
            <span className="save-note">
              <Icon name="check" size={15} />
              Saved
            </span>
          )}
        </div>
      </form>

      <section className="card">
        <div className="card-head">
          <h2>Connection</h2>
          <p className="card-sub">The smart contract behind live payments.</p>
        </div>
        <dl className="info-list">
          <div>
            <dt>Contract</dt>
            <dd className="mono">{CONTRACT_ID}</dd>
          </div>
          <div>
            <dt>Network</dt>
            <dd>NEAR testnet</dd>
          </div>
          <div>
            <dt>Mode</dt>
            <dd>{mode === "demo" ? "Demo — local browser state" : "Live — signed transactions"}</dd>
          </div>
          <div>
            <dt>Business handle</dt>
            <dd className="mono">@{dashboard.business.handle || "business"}</dd>
          </div>
        </dl>
      </section>

      {mode === "demo" && (
        <section className="card danger-zone">
          <div className="card-head">
            <h2>Reset the demo</h2>
            <p className="card-sub">
              Deletes this workspace from your browser and starts over. This cannot be undone.
            </p>
          </div>
          <button
            className="btn danger"
            onClick={() => {
              if (window.confirm("Delete the demo workspace and start over?")) onReset();
            }}
          >
            <Icon name="trash" size={15} />
            Delete demo data
          </button>
        </section>
      )}
    </>
  );
}
