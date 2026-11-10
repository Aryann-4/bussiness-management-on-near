import { useState } from "react";
import type { Mode, Run } from "../appTypes";
import { Icon } from "../components/Icon";
import { EmptyState } from "../components/ui";
import * as demo from "../demoStore";
import { live } from "../near";
import { formatDate } from "../money";
import type { Customer, Dashboard } from "../types";

export default function Customers({
  mode,
  dashboard,
  busy,
  run,
}: {
  mode: Mode;
  dashboard: Dashboard;
  busy: boolean;
  run: Run;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const ok = await run(`Customer ${name.trim()} added`, {
      demo: () => demo.addCustomer(dashboard, name, email),
      live: () => live.addCustomer(name, email),
    });
    if (ok) {
      setName("");
      setEmail("");
    }
  };

  const invoiceCount = (customer: Customer) =>
    dashboard.invoices.filter((invoice) => invoice.customer_id === customer.id).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Customers</h1>
          <p className="page-sub">The people and companies you send invoices to.</p>
        </div>
      </div>

      <form className="card" onSubmit={submit}>
        <div className="card-head">
          <h2>Add a customer</h2>
          <p className="card-sub">
            {mode === "demo"
              ? "Stored in this browser for the demo."
              : "Saved on NEAR testnet with a signed transaction."}
          </p>
        </div>
        <div className="inline-form">
          <div className="field">
            <label htmlFor="customer-name">Name</label>
            <input
              id="customer-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ada Lovelace"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="customer-email">Email (optional)</label>
            <input
              id="customer-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="ada@example.com"
            />
          </div>
          <button className="btn primary" type="submit" disabled={busy}>
            <Icon name="plus" size={16} />
            {busy ? "Adding…" : "Add customer"}
          </button>
        </div>
      </form>

      <section className="card">
        <div className="card-head">
          <h2>Customer list</h2>
          <p className="card-sub">
            {dashboard.customers.length} customer{dashboard.customers.length === 1 ? "" : "s"} in total.
          </p>
        </div>

        {dashboard.customers.length === 0 ? (
          <EmptyState
            icon="users"
            title="No customers yet"
            hint="Add someone above and they will be ready to invoice."
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Invoices</th>
                  <th>Added</th>
                  <th className="align-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.customers.map((customer) => (
                  <tr key={customer.id}>
                    <td className="cell-strong">{customer.name}</td>
                    <td className="muted">{customer.email || "—"}</td>
                    <td>{invoiceCount(customer)}</td>
                    <td className="muted">{formatDate(customer.created_at)}</td>
                    <td>
                      <div className="row-actions">
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
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
