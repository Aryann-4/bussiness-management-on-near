import * as demo from "./demoStore";
import { nearToYocto } from "./money";
import type { Dashboard } from "./types";

/**
 * Workspace seed described as data so it can be replayed two ways:
 *  - demo:   applied locally through demoStore (no wallet)
 *  - live:   sent as ONE batched transaction (one wallet approval)
 */
export type SeedSpec = {
  business: { name: string; handle: string; email: string; currency: string; tax_bps: number };
  customers: Array<{ name: string; email: string }>;
  products: Array<{ name: string; price_yocto: string }>;
  invoices: Array<{
    customer_id: number;
    items: Array<{ description: string; quantity: number; unit_price: string }>;
    due_days: number;
    /** Mark this invoice Sent after creating it. */
    status?: "Sent";
    /** Pay this invoice immediately (deposit = its total). */
    pay?: boolean;
  }>;
};

/** Sample workspace shown in demo mode — storybook amounts. */
export const sampleSpec: SeedSpec = {
  business: {
    name: "Acme Studio",
    handle: "acme",
    email: "billing@acme.studio",
    currency: "NEAR",
    tax_bps: 1500,
  },
  customers: [
    { name: "Ada Lovelace", email: "ada@example.com" },
    { name: "Grace Hopper", email: "grace@example.com" },
    { name: "Linus Torvalds", email: "linus@example.com" },
  ],
  products: [
    { name: "Brand identity sprint", price_yocto: nearToYocto("180") },
    { name: "Landing page build", price_yocto: nearToYocto("95") },
    { name: "Monthly support retainer", price_yocto: nearToYocto("40") },
  ],
  invoices: [
    {
      customer_id: 1,
      items: [
        { description: "Brand identity sprint", quantity: 1, unit_price: nearToYocto("180") },
        { description: "Landing page build", quantity: 1, unit_price: nearToYocto("95") },
      ],
      due_days: 21,
      pay: true,
    },
    {
      customer_id: 2,
      items: [{ description: "Monthly support retainer", quantity: 2, unit_price: nearToYocto("40") }],
      due_days: 14,
      status: "Sent",
    },
    {
      customer_id: 3,
      items: [{ description: "Landing page build", quantity: 1, unit_price: nearToYocto("95") }],
      due_days: 30,
    },
  ],
};

/** Builds a realistic workspace so the demo tells a story immediately. */
export function seedDashboard(): Dashboard {
  const s = sampleSpec;
  let d = demo.createBusiness(s.business);
  for (const c of s.customers) d = demo.addCustomer(d, c.name, c.email);
  for (const p of s.products) d = demo.addProduct(d, p.name, p.price_yocto);
  for (const inv of s.invoices) {
    const created = demo.createInvoice(d, inv.customer_id, inv.items, inv.due_days);
    d = created.dashboard;
    if (inv.status) d = demo.setStatus(d, created.invoice.id, inv.status);
    if (inv.pay) d = demo.payInvoice(d, created.invoice.id);
  }
  return d;
}

/**
 * The same storybook workspace with testnet-sane prices, used for the
 * one-approval live setup — paying the first invoice on-chain must cost
 * under 1 NEAR so a fresh testnet wallet can afford it.
 */
export const liveSampleSpec: SeedSpec = {
  ...sampleSpec,
  products: [
    { name: "Brand identity sprint", price_yocto: nearToYocto("0.4") },
    { name: "Landing page build", price_yocto: nearToYocto("0.3") },
    { name: "Monthly support retainer", price_yocto: nearToYocto("0.2") },
  ],
  invoices: [
    {
      customer_id: 1,
      items: [
        { description: "Brand identity sprint", quantity: 1, unit_price: nearToYocto("0.4") },
        { description: "Landing page build", quantity: 1, unit_price: nearToYocto("0.3") },
      ],
      due_days: 21,
      pay: true,
    },
    {
      customer_id: 2,
      items: [{ description: "Monthly support retainer", quantity: 2, unit_price: nearToYocto("0.2") }],
      due_days: 14,
      status: "Sent",
    },
    {
      customer_id: 3,
      items: [{ description: "Landing page build", quantity: 1, unit_price: nearToYocto("0.3") }],
      due_days: 30,
    },
  ],
};
