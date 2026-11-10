import type { Tab } from "../appTypes";
import { Icon } from "../components/Icon";
import { EmptyState, StatCard, StatusBadge } from "../components/ui";
import { formatDate, formatNear } from "../money";
import type { Dashboard, Stats } from "../types";

export default function Overview({
  dashboard,
  stats,
  onNavigate,
}: {
  dashboard: Dashboard;
  stats: Stats;
  onNavigate: (tab: Tab) => void;
}) {
  const currency = dashboard.business.currency;
  const recent = [...dashboard.invoices].sort((a, b) => b.id - a.id).slice(0, 5);
  const customerName = (id: number) =>
    dashboard.customers.find((customer) => customer.id === id)?.name ?? `Customer #${id}`;

  const steps = [
    { done: stats.customers > 0, label: "Add your first customer", tab: "customers" as Tab },
    { done: stats.products > 0, label: "Add a product or service", tab: "products" as Tab },
    { done: stats.invoices > 0, label: "Create an invoice", tab: "invoices" as Tab },
    { done: stats.paid_invoices > 0, label: "Get your first payment", tab: "invoices" as Tab },
  ];
  const remaining = steps.filter((step) => !step.done).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Hello, {dashboard.business.name}</h1>
          <p className="page-sub">Here is how your business is doing today.</p>
        </div>
        <button className="btn primary" onClick={() => onNavigate("invoices")}>
          <Icon name="plus" size={16} />
          New invoice
        </button>
      </div>

      <div className="stats-grid">
        <StatCard
          icon="wallet"
          tone="mint"
          label="Money received"
          value={formatNear(stats.revenue, currency)}
          hint={`${stats.paid_invoices} paid invoice${stats.paid_invoices === 1 ? "" : "s"}`}
        />
        <StatCard
          icon="clock"
          tone="amber"
          label="Awaiting payment"
          value={formatNear(stats.outstanding, currency)}
          hint={`${stats.open_invoices} open invoice${stats.open_invoices === 1 ? "" : "s"}`}
        />
        <StatCard
          icon="users"
          tone="indigo"
          label="Customers"
          value={String(stats.customers)}
          hint="people you invoice"
        />
        <StatCard
          icon="invoice"
          tone="sky"
          label="Invoices"
          value={String(stats.invoices)}
          hint={`${stats.open_invoices} still open`}
        />
      </div>

      <div className="overview-grid">
        <div className="stack">
          <section className="card">
            <div className="card-head row-between">
              <div>
                <h2>Recent invoices</h2>
                <p className="card-sub">Your latest bills and their status.</p>
              </div>
              <button className="btn ghost small" onClick={() => onNavigate("invoices")}>
                View all
                <Icon name="arrow" size={14} />
              </button>
            </div>

            {recent.length === 0 ? (
              <EmptyState
                icon="invoice"
                title="No invoices yet"
                hint="Create one and it will appear here with its status."
                action={
                  <button className="btn small" onClick={() => onNavigate("invoices")}>
                    Create an invoice
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
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((invoice) => (
                      <tr key={invoice.id}>
                        <td className="cell-strong mono">#{String(invoice.id).padStart(4, "0")}</td>
                        <td>{customerName(invoice.customer_id)}</td>
                        <td>{formatNear(invoice.total, currency)}</td>
                        <td>
                          <StatusBadge status={invoice.status} />
                        </td>
                        <td className="muted">{formatDate(invoice.due_date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card">
            <div className="card-head">
              <h2>What you sell</h2>
              <p className="card-sub">Your catalogue, ready to add to any invoice.</p>
            </div>
            {dashboard.products.length === 0 ? (
              <EmptyState
                icon="box"
                title="No products yet"
                hint="Add a product or service so invoicing takes seconds."
                action={
                  <button className="btn small" onClick={() => onNavigate("products")}>
                    Add a product
                  </button>
                }
              />
            ) : (
              <ul className="simple-list">
                {dashboard.products.slice(0, 5).map((product) => (
                  <li key={product.id}>
                    <span className={`dot-status ${product.active ? "on" : "off"}`} />
                    <span className="simple-list-name">{product.name}</span>
                    <span className="simple-list-value">{formatNear(product.price, currency)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="stack">
          <section className="card">
            <div className="card-head row-between">
              <div>
                <h2>Getting started</h2>
                <p className="card-sub">
                  {remaining === 0 ? "You are all set up. Nice work!" : `${remaining} step${remaining === 1 ? "" : "s"} left`}
                </p>
              </div>
              <span className="progress-tag">
                {steps.length - remaining}/{steps.length}
              </span>
            </div>
            <ul className="checklist">
              {steps.map((step) => (
                <li key={step.label} className={`check-item ${step.done ? "done" : ""}`}>
                  <span className="check-icon">
                    <Icon name={step.done ? "check" : "arrow"} size={14} />
                  </span>
                  <span className="check-label">{step.label}</span>
                  {!step.done && (
                    <button className="btn ghost small" onClick={() => onNavigate(step.tab)}>
                      Go
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className="card">
            <div className="card-head">
              <h2>How payment works</h2>
              <p className="card-sub">Three simple steps, every time.</p>
            </div>
            <ol className="steps">
              <li>
                <span className="step-num">1</span>
                <div>
                  <strong>Create an invoice</strong>
                  <span>Pick a customer, add line items, done.</span>
                </div>
              </li>
              <li>
                <span className="step-num">2</span>
                <div>
                  <strong>Send it to your customer</strong>
                  <span>They see the exact total, including tax.</span>
                </div>
              </li>
              <li>
                <span className="step-num">3</span>
                <div>
                  <strong>Get paid in NEAR</strong>
                  <span>The money lands in your account automatically.</span>
                </div>
              </li>
            </ol>
          </section>
        </div>
      </div>
    </>
  );
}
