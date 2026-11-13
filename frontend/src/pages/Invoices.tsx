import { useMemo, useState } from "react";
import type { Mode, Run } from "../appTypes";
import { Icon } from "../components/Icon";
import { EmptyState, Modal, StatusBadge } from "../components/ui";
import { live } from "../near";
import { formatDate, formatNear, nearToYocto } from "../money";
import * as demo from "../demoStore";
import type { Dashboard, Invoice, InvoiceItemInput, InvoiceStatus } from "../types";
import { celebratePayment } from "../celebrate";

const emptyLine = () => ({ description: "", quantity: "1", unit: "" });

export default function Invoices({
  mode,
  account,
  dashboard,
  busy,
  run,
  onGoCustomers,
}: {
  mode: Mode;
  account: string | null;
  dashboard: Dashboard;
  busy: boolean;
  run: Run;
  onGoCustomers: () => void;
}) {
  const currency = dashboard.business.currency;
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [dueDays, setDueDays] = useState("14");
  const [items, setItems] = useState([emptyLine(), emptyLine()]);
  const [formError, setFormError] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<number | null>(null);

  const viewing = dashboard.invoices.find((invoice) => invoice.id === viewingId) ?? null;
  const customerName = (id: number) =>
    dashboard.customers.find((customer) => customer.id === id)?.name ?? `Customer #${id}`;

  const preview = useMemo(() => {
    let subtotal = 0n;
    for (const item of items) {
      try {
        subtotal += BigInt(nearToYocto(item.unit || "0")) * BigInt(Math.max(0, Number(item.quantity) || 0));
      } catch {
        /* ignore invalid input while typing */
      }
    }
    const tax = (subtotal * BigInt(dashboard.business.tax_bps)) / 10_000n;
    return { subtotal, tax, total: subtotal + tax };
  }, [items, dashboard.business.tax_bps]);

  const hasLine = items.some((item) => item.description.trim() && item.unit.trim());

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (customerId === "") {
      setFormError("Choose a customer for this invoice.");
      return;
    }

    let lines: InvoiceItemInput[];
    try {
      lines = items
        .filter((item) => item.description.trim() && item.unit.trim())
        .map((item) => ({
          description: item.description,
          quantity: Math.max(1, Number(item.quantity) || 1),
          unit_price: nearToYocto(item.unit),
        }));
    } catch {
      setFormError("Check the unit prices — use numbers like 25 or 12.5.");
      return;
    }

    if (lines.length === 0) {
      setFormError("Add at least one line item with a description and price.");
      return;
    }

    const id = Number(customerId);
    const ok = await run(`Invoice created for ${customerName(id)}`, {
      demo: () => demo.createInvoice(dashboard, id, lines, Number(dueDays) || 0).dashboard,
      live: () => live.createInvoice(id, lines, Number(dueDays) || 0),
    });
    if (ok) {
      setItems([emptyLine(), emptyLine()]);
      setCustomerId("");
      setOpen(false);
    }
  };

  const updateStatus = async (invoice: Invoice, status: InvoiceStatus) => {
    const ok = await run(`Invoice #${invoice.id} marked ${status.toLowerCase()}`, {
      demo: () => demo.setStatus(dashboard, invoice.id, status),
      live: () => live.setStatus(invoice.id, status),
    });
    if (ok && viewingId === invoice.id) setViewingId(null);
  };

  const copyPaymentLink = async (invoice: Invoice) => {
    await run("Payment link copied", {
      demo: () => {
        throw new Error("Payment links need live mode — switch to Try on NEAR first");
      },
      live: async () => {
        if (!account) throw new Error("Connect a NEAR wallet first");
        const url = `${window.location.origin}${window.location.pathname}?pay=${encodeURIComponent(account)}:${invoice.id}`;
        try {
          await navigator.clipboard.writeText(url);
        } catch {
          // Clipboard blocked — show the link instead.
          window.prompt("Copy the payment link:", url);
        }
      },
    });
  };

  const pay = async (invoice: Invoice) => {
    const ok = await run(`Invoice #${invoice.id} paid`, {
      demo: () => demo.payInvoice(dashboard, invoice.id),
      live: async () => {
        if (!account) throw new Error("Connect a NEAR wallet first");
        await live.payInvoice(account, invoice.id, invoice.total);
      },
    });
    if (ok) celebratePayment();
    if (ok && viewingId === invoice.id) setViewingId(null);
  };

  const addLine = () => setItems([...items, emptyLine()]);
  const removeLine = (index: number) =>
    setItems(items.length === 1 ? items : items.filter((_, i) => i !== index));

  const canSubmit = customerId !== "" && hasLine && !busy;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Invoices</h1>
          <p className="page-sub">
            {dashboard.invoices.length} invoice{dashboard.invoices.length === 1 ? "" : "s"} ·{" "}
            {mode === "demo" ? "demo workspace" : "stored on NEAR"}
          </p>
        </div>
        <button className="btn primary" onClick={() => setOpen((value) => !value)}>
          <Icon name="plus" size={16} />
          {open ? "Close form" : "New invoice"}
        </button>
      </div>

      {open && (
        <form className="card invoice-form" onSubmit={submit}>
          <div className="card-head">
            <h2>Create an invoice</h2>
            <p className="card-sub">Pick a customer, add what you sold, and we will total it up.</p>
          </div>

          {dashboard.customers.length === 0 ? (
            <EmptyState
              icon="users"
              title="You need a customer first"
              hint="Invoices are always addressed to someone. It only takes a moment."
              action={
                <button type="button" className="btn small" onClick={onGoCustomers}>
                  Add a customer
                </button>
              }
            />
          ) : (
            <div className="invoice-form-grid">
              <div className="stack">
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="invoice-customer">Bill to</label>
                    <select
                      id="invoice-customer"
                      value={customerId}
                      onChange={(event) => setCustomerId(event.target.value)}
                      required
                    >
                      <option value="">Choose a customer…</option>
                      {dashboard.customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="invoice-due">Payment due in</label>
                    <div className="input-suffix">
                      <input
                        id="invoice-due"
                        type="number"
                        min="0"
                        value={dueDays}
                        onChange={(event) => setDueDays(event.target.value)}
                      />
                      <span>days</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label>What are you charging for?</label>
                  <div className="line-items">
                    {items.map((item, index) => (
                      <div className="line-item" key={index}>
                        <input
                          aria-label={`Description for line ${index + 1}`}
                          placeholder="Description, e.g. Website design"
                          value={item.description}
                          onChange={(event) => {
                            const next = [...items];
                            next[index] = { ...item, description: event.target.value };
                            setItems(next);
                          }}
                        />
                        <input
                          aria-label={`Quantity for line ${index + 1}`}
                          type="number"
                          min="1"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(event) => {
                            const next = [...items];
                            next[index] = { ...item, quantity: event.target.value };
                            setItems(next);
                          }}
                        />
                        <div className="input-prefix">
                          <span>NEAR</span>
                          <input
                            aria-label={`Unit price for line ${index + 1}`}
                            placeholder="0.00"
                            inputMode="decimal"
                            value={item.unit}
                            onChange={(event) => {
                              const next = [...items];
                              next[index] = { ...item, unit: event.target.value };
                              setItems(next);
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          className="icon-btn remove"
                          onClick={() => removeLine(index)}
                          disabled={items.length === 1}
                          aria-label="Remove line"
                        >
                          <Icon name="trash" size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button type="button" className="btn ghost small add-line" onClick={addLine}>
                    <Icon name="plus" size={14} />
                    Add another line
                  </button>
                </div>

                {formError && (
                  <div className="form-error">
                    <Icon name="info" size={15} />
                    {formError}
                  </div>
                )}
              </div>

              <aside className="summary">
                <div className="summary-title">
                  <Icon name="card" size={16} />
                  Invoice summary
                </div>
                <div className="summary-row">
                  <span>Subtotal</span>
                  <span>{formatNear(preview.subtotal.toString(), currency)}</span>
                </div>
                <div className="summary-row">
                  <span>Tax ({dashboard.business.tax_bps / 100}%)</span>
                  <span>{formatNear(preview.tax.toString(), currency)}</span>
                </div>
                <div className="summary-row total">
                  <span>Total due</span>
                  <span key={preview.total.toString()} className="amount-pop">
                    {formatNear(preview.total.toString(), currency)}
                  </span>
                </div>
                <button className="btn primary block" type="submit" disabled={!canSubmit}>
                  {busy ? "Creating…" : "Create invoice"}
                </button>
                <p className="hint center">You can send it to the customer right after.</p>
              </aside>
            </div>
          )}
        </form>
      )}

      <section className="card">
        <div className="card-head">
          <h2>All invoices</h2>
          <p className="card-sub">Draft, send, collect payment — all in one place.</p>
        </div>

        {dashboard.invoices.length === 0 ? (
          <EmptyState
            icon="invoice"
            title="No invoices yet"
            hint="Your invoices will show up here with a clear status."
            action={
              <button className="btn small" onClick={() => setOpen(true)}>
                Create your first invoice
              </button>
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Due</th>
                  <th className="align-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {[...dashboard.invoices].reverse().map((invoice) => (
                  <tr key={invoice.id}>
                    <td data-label="Invoice" className="cell-strong mono">
                      #{String(invoice.id).padStart(4, "0")}
                    </td>
                    <td data-label="Customer">{customerName(invoice.customer_id)}</td>
                    <td data-label="Total">{formatNear(invoice.total, currency)}</td>
                    <td data-label="Status">
                      <StatusBadge status={invoice.status} />
                    </td>
                    <td data-label="Due" className="muted">
                      {formatDate(invoice.due_date)}
                    </td>
                    <td className="cell-actions">
                      <div className="row-actions">
                        <button className="btn ghost small" onClick={() => setViewingId(invoice.id)}>
                          View
                        </button>
                        {invoice.status === "Draft" && (
                          <button
                            className="btn small"
                            onClick={() => updateStatus(invoice, "Sent")}
                            disabled={busy}
                          >
                            <Icon name="send" size={13} />
                            Send
                          </button>
                        )}
                        {invoice.status !== "Paid" && invoice.status !== "Cancelled" && (
                          <button
                            className="btn primary small"
                            onClick={() =>
                              mode === "demo" ? pay(invoice) : copyPaymentLink(invoice)
                            }
                            disabled={busy}
                          >
                            <Icon name={mode === "demo" ? "wallet" : "card"} size={13} />
                            {mode === "demo" ? "Mark paid" : "Payment link"}
                          </button>
                        )}
                        {invoice.status !== "Paid" && invoice.status !== "Cancelled" && (
                          <button
                            className="btn danger small"
                            onClick={() => updateStatus(invoice, "Cancelled")}
                            disabled={busy}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        open={viewing !== null}
        onClose={() => setViewingId(null)}
        title={viewing ? `Invoice #${String(viewing.id).padStart(4, "0")}` : "Invoice"}
        subtitle={
          viewing
            ? `${customerName(viewing.customer_id)} · issued ${formatDate(viewing.created_at)} · due ${formatDate(viewing.due_date)}`
            : undefined
        }
        footer={
          viewing && (
            <>
              <button className="btn ghost" onClick={() => setViewingId(null)}>
                Close
              </button>
              {viewing.status === "Draft" && (
                <button className="btn" onClick={() => updateStatus(viewing, "Sent")} disabled={busy}>
                  <Icon name="send" size={14} />
                  Mark as sent
                </button>
              )}
              {viewing.status !== "Paid" && viewing.status !== "Cancelled" && (
                <button
                  className="btn primary"
                  onClick={() =>
                    mode === "demo" ? pay(viewing) : copyPaymentLink(viewing)
                  }
                  disabled={busy}
                >
                  <Icon name={mode === "demo" ? "wallet" : "card"} size={14} />
                  {mode === "demo" ? "Mark as paid" : "Copy payment link"}
                </button>
              )}
            </>
          )
        }
      >
        {viewing && (
          <>
            <div className="row-between" style={{ marginBottom: 14 }}>
              <StatusBadge status={viewing.status} />
              <span className="muted">
                Total {formatNear(viewing.total, currency)}
              </span>
            </div>

            <div className="table-wrap">
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
                      <td data-label="Description">{item.description}</td>
                      <td data-label="Qty">{item.quantity}</td>
                      <td data-label="Unit">{formatNear(item.unit_price, currency)}</td>
                      <td data-label="Amount">{formatNear(item.amount, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="totals">
              <div className="summary-row">
                <span>Subtotal</span>
                <span>{formatNear(viewing.subtotal, currency)}</span>
              </div>
              <div className="summary-row">
                <span>Tax</span>
                <span>{formatNear(viewing.tax, currency)}</span>
              </div>
              <div className="summary-row total">
                <span>Total</span>
                <span>{formatNear(viewing.total, currency)}</span>
              </div>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
