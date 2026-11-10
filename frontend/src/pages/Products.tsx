import { useState } from "react";
import type { Mode, Run } from "../appTypes";
import { Icon } from "../components/Icon";
import { EmptyState } from "../components/ui";
import * as demo from "../demoStore";
import { live } from "../near";
import { formatNear, nearToYocto } from "../money";
import type { Dashboard, Product } from "../types";

export default function Products({
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
  const currency = dashboard.business.currency;
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    let yocto: string;
    try {
      yocto = nearToYocto(price);
    } catch {
      setError("Enter a price in NEAR, for example 25 or 12.5.");
      return;
    }

    const ok = await run(`${name.trim()} added to your catalogue`, {
      demo: () => demo.addProduct(dashboard, name, yocto),
      live: () => live.addProduct(name, yocto),
    });
    if (ok) {
      setName("");
      setPrice("");
    }
  };

  const toggle = (product: Product) =>
    run(`${product.name} ${product.active ? "archived" : "reactivated"}`, {
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
      <div className="page-head">
        <div>
          <h1>Products &amp; services</h1>
          <p className="page-sub">Save what you sell once, then add it to invoices in one click.</p>
        </div>
      </div>

      <form className="card" onSubmit={submit}>
        <div className="card-head">
          <h2>Add something you sell</h2>
          <p className="card-sub">
            {mode === "demo"
              ? "Stored in this browser for the demo."
              : "Saved on NEAR testnet with a signed transaction."}
          </p>
        </div>
        <div className="inline-form">
          <div className="field">
            <label htmlFor="product-name">Name</label>
            <input
              id="product-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Landing page build"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="product-price">Price in NEAR</label>
            <div className="input-prefix">
              <span>NEAR</span>
              <input
                id="product-price"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                placeholder="95"
                inputMode="decimal"
                required
              />
            </div>
          </div>
          <button className="btn primary" type="submit" disabled={busy}>
            <Icon name="plus" size={16} />
            {busy ? "Adding…" : "Add product"}
          </button>
        </div>
        {error && (
          <p className="form-error">
            <Icon name="info" size={15} />
            {error}
          </p>
        )}
      </form>

      <section className="card">
        <div className="card-head">
          <h2>Your catalogue</h2>
          <p className="card-sub">
            {dashboard.products.length} item{dashboard.products.length === 1 ? "" : "s"} · archived
            items stay in your history.
          </p>
        </div>

        {dashboard.products.length === 0 ? (
          <EmptyState
            icon="box"
            title="Nothing here yet"
            hint="Add a product or service above to speed up your next invoice."
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th className="align-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.products.map((product) => (
                  <tr key={product.id}>
                    <td className="cell-strong">{product.name}</td>
                    <td>{formatNear(product.price, currency)}</td>
                    <td>
                      <span className={`badge ${product.active ? "paid" : "draft"}`}>
                        <span className="badge-dot" />
                        {product.active ? "Active" : "Archived"}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="btn small" onClick={() => toggle(product)} disabled={busy}>
                          {product.active ? "Archive" : "Reactivate"}
                        </button>
                        <button
                          className="btn danger small"
                          onClick={() => remove(product)}
                          disabled={busy}
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
