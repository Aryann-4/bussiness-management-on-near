import type {
  Customer,
  Dashboard,
  Invoice,
  InvoiceItemInput,
  InvoiceStatus,
  Product,
  Stats,
} from "./types";

const STORAGE_KEY = "near-business-manager:dashboard:v1";
const TAX_DENOMINATOR = 10_000;
const DAY_NS = 24 * 60 * 60 * 1_000_000_000;

export const DEMO_ACCOUNT = "demo.near";

/** In-browser engine that mirrors the on-chain contract for the demo link. */
export function loadDemo(): Dashboard | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Dashboard) : null;
  } catch {
    return null;
  }
}

export function saveDemo(dashboard: Dashboard | null): void {
  if (!dashboard) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dashboard));
}

function requireDashboard(dashboard: Dashboard | null): Dashboard {
  if (!dashboard) throw new Error("Create a business profile first");
  return dashboard;
}

export function createBusiness(
  input: Omit<Dashboard["business"], "created_at">,
): Dashboard {
  if (!input.name.trim()) throw new Error("Business name is required");
  if (input.tax_bps < 0 || input.tax_bps > 5000) throw new Error("Tax cannot exceed 50%");
  return {
    business: {
      ...input,
      name: input.name.trim(),
      handle: input.handle.trim().toLowerCase(),
      email: input.email.trim(),
      currency: (input.currency || "NEAR").trim().toUpperCase(),
      created_at: Date.now() * 1_000_000,
    },
    customers: [],
    products: [],
    accepted_token: null,
    invoices: [],
    revenue: "0",
    next_customer_id: 1,
    next_product_id: 1,
    next_invoice_id: 1,
  };
}

export function addCustomer(
  dashboard: Dashboard | null,
  name: string,
  email: string,
): Dashboard {
  const d = requireDashboard(dashboard);
  if (!name.trim()) throw new Error("Customer name is required");
  const customer: Customer = {
    id: d.next_customer_id,
    name: name.trim(),
    email: email.trim(),
    created_at: Date.now() * 1_000_000,
  };
  return {
    ...d,
    customers: [...d.customers, customer],
    next_customer_id: d.next_customer_id + 1,
  };
}

export function removeCustomer(dashboard: Dashboard | null, id: number): Dashboard {
  const d = requireDashboard(dashboard);
  return { ...d, customers: d.customers.filter((c) => c.id !== id) };
}

export function addProduct(
  dashboard: Dashboard | null,
  name: string,
  price: string,
): Dashboard {
  const d = requireDashboard(dashboard);
  if (!name.trim()) throw new Error("Product name is required");
  const product: Product = {
    id: d.next_product_id,
    name: name.trim(),
    price,
    active: true,
  };
  return {
    ...d,
    products: [...d.products, product],
    next_product_id: d.next_product_id + 1,
  };
}

export function toggleProduct(dashboard: Dashboard | null, id: number): Dashboard {
  const d = requireDashboard(dashboard);
  return {
    ...d,
    products: d.products.map((p) => (p.id === id ? { ...p, active: !p.active } : p)),
  };
}

export function removeProduct(dashboard: Dashboard | null, id: number): Dashboard {
  const d = requireDashboard(dashboard);
  return { ...d, products: d.products.filter((p) => p.id !== id) };
}

export function createInvoice(
  dashboard: Dashboard | null,
  customerId: number,
  items: InvoiceItemInput[],
  dueDays: number,
): { dashboard: Dashboard; invoice: Invoice } {
  const d = requireDashboard(dashboard);
  if (!items.length) throw new Error("Invoice needs at least one line item");
  if (!d.customers.some((c) => c.id === customerId)) throw new Error("Customer not found");

  let subtotal = 0n;
  const stored = items.map((item) => {
    if (!item.description.trim()) throw new Error("Item description required");
    if (item.quantity <= 0) throw new Error("Quantity must be positive");
    const amount = BigInt(item.unit_price) * BigInt(item.quantity);
    subtotal += amount;
    return {
      description: item.description.trim(),
      quantity: item.quantity,
      unit_price: item.unit_price,
      amount: amount.toString(),
    };
  });

  const tax = (subtotal * BigInt(d.business.tax_bps)) / BigInt(TAX_DENOMINATOR);
  const total = subtotal + tax;
  const nowNs = Date.now() * 1_000_000;

  const invoice: Invoice = {
    id: d.next_invoice_id,
    customer_id: customerId,
    items: stored,
    subtotal: subtotal.toString(),
    tax: tax.toString(),
    total: total.toString(),
    status: "Draft",
    created_at: nowNs,
    due_date: nowNs + dueDays * DAY_NS,
    paid_at: null,
  };

  return {
    dashboard: {
      ...d,
      invoices: [...d.invoices, invoice],
      next_invoice_id: d.next_invoice_id + 1,
    },
    invoice,
  };
}

export function setStatus(
  dashboard: Dashboard | null,
  invoiceId: number,
  status: InvoiceStatus,
): Dashboard {
  const d = requireDashboard(dashboard);
  return {
    ...d,
    invoices: d.invoices.map((inv) => {
      if (inv.id !== invoiceId) return inv;
      if (inv.status === "Paid") throw new Error("Paid invoices cannot change status");
      return { ...inv, status };
    }),
  };
}

export function payInvoice(dashboard: Dashboard | null, invoiceId: number): Dashboard {
  const d = requireDashboard(dashboard);
  let paid: Invoice | undefined;
  const invoices = d.invoices.map((inv) => {
    if (inv.id !== invoiceId) return inv;
    if (inv.status === "Paid") throw new Error("Invoice already paid");
    if (inv.status === "Cancelled") throw new Error("Invoice was cancelled");
    paid = { ...inv, status: "Paid" as InvoiceStatus, paid_at: Date.now() * 1_000_000 };
    return paid;
  });
  if (!paid) throw new Error("Invoice not found");
  return {
    ...d,
    invoices,
    revenue: (BigInt(d.revenue) + BigInt(paid.total)).toString(),
  };
}

export function statsOf(dashboard: Dashboard | null): Stats {
  if (!dashboard) {
    return {
      customers: 0,
      products: 0,
      invoices: 0,
      paid_invoices: 0,
      open_invoices: 0,
      revenue: "0",
      outstanding: "0",
    };
  }
  let paid = 0;
  let open = 0;
  let outstanding = 0n;
  for (const invoice of dashboard.invoices) {
    if (invoice.status === "Paid") paid += 1;
    else if (invoice.status !== "Cancelled") {
      open += 1;
      outstanding += BigInt(invoice.total);
    }
  }
  return {
    customers: dashboard.customers.length,
    products: dashboard.products.length,
    invoices: dashboard.invoices.length,
    paid_invoices: paid,
    open_invoices: open,
    revenue: dashboard.revenue,
    outstanding: outstanding.toString(),
  };
}
