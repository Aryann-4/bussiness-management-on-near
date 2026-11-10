import { useState } from "react";
import type { Mode } from "../appTypes";
import { Icon } from "../components/Icon";

export default function Onboarding({
  mode,
  busy,
  onCreate,
  onSample,
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
  onSample: () => void;
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
      <section className="hero-copy">
        <span className="eyebrow">
          <Icon name="spark" size={15} />
          Everything in one place
        </span>
        <h1>Run your online business without the spreadsheet chaos.</h1>
        <p className="hero-lead">
          Keep customers, products and invoices together — then get paid in NEAR. Simple to set up,
          easy to read, and every payment is recorded for you.
        </p>

        <ul className="feature-list">
          <li className="feature">
            <span className="feature-icon tone-indigo">
              <Icon name="invoice" size={18} />
            </span>
            <div>
              <strong>Invoices that do the math</strong>
              <span>Line items, tax and totals are calculated for you.</span>
            </div>
          </li>
          <li className="feature">
            <span className="feature-icon tone-mint">
              <Icon name="wallet" size={18} />
            </span>
            <div>
              <strong>Get paid straight to your account</strong>
              <span>Customers pay the exact amount in NEAR in one step.</span>
            </div>
          </li>
          <li className="feature">
            <span className="feature-icon tone-sky">
              <Icon name="chart" size={18} />
            </span>
            <div>
              <strong>Know where you stand</strong>
              <span>See what you earned, what is owed and what is due next.</span>
            </div>
          </li>
        </ul>

        {mode === "demo" && (
          <button type="button" className="btn subtle" onClick={onSample}>
            <Icon name="spark" size={16} />
            Explore with sample data
          </button>
        )}
      </section>

      <form className="card form-card" onSubmit={submit}>
        <div className="card-head">
          <h2>Set up your business</h2>
          <p className="card-sub">This is the name your customers will see on invoices.</p>
        </div>

        <div className="field">
          <label htmlFor="biz-name">Business name</label>
          <input
            id="biz-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Acme Studio"
            autoComplete="organization"
            required
          />
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="biz-handle">Handle</label>
            <input
              id="biz-handle"
              value={form.handle}
              onChange={(e) => setForm({ ...form, handle: e.target.value })}
              placeholder="acme"
            />
            <p className="hint">A short name, like a username.</p>
          </div>
          <div className="field">
            <label htmlFor="biz-email">Billing email</label>
            <input
              id="biz-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="billing@acme.com"
              autoComplete="email"
            />
            <p className="hint">Shown on invoices you send.</p>
          </div>
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="biz-currency">Currency label</label>
            <input
              id="biz-currency"
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
              placeholder="NEAR"
            />
            <p className="hint">Displayed next to every amount.</p>
          </div>
          <div className="field">
            <label htmlFor="biz-tax">Tax rate (%)</label>
            <input
              id="biz-tax"
              type="number"
              min="0"
              max="50"
              step="0.1"
              value={form.tax}
              onChange={(e) => setForm({ ...form, tax: e.target.value })}
            />
            <p className="hint">Added to each invoice. Use 0 for none.</p>
          </div>
        </div>

        <div className="form-foot">
          <button className="btn primary" type="submit" disabled={busy}>
            {busy ? "Creating…" : "Create my dashboard"}
            {!busy && <Icon name="arrow" size={16} />}
          </button>
          <span className="hint">
            {mode === "demo" ? "Saved in this browser — no wallet needed." : "Signed on NEAR testnet."}
          </span>
        </div>
      </form>
    </div>
  );
}
