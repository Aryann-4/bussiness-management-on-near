import * as demo from "./demoStore";
import { nearToYocto } from "./money";
import type { Dashboard } from "./types";

/** Builds a realistic workspace so the demo tells a story immediately. */
export function seedDashboard(): Dashboard {
  let d = demo.createBusiness({
    name: "Acme Studio",
    handle: "acme",
    email: "billing@acme.studio",
    currency: "NEAR",
    tax_bps: 1500,
  });

  d = demo.addCustomer(d, "Ada Lovelace", "ada@example.com");
  d = demo.addCustomer(d, "Grace Hopper", "grace@example.com");
  d = demo.addCustomer(d, "Linus Torvalds", "linus@example.com");

  d = demo.addProduct(d, "Brand identity sprint", nearToYocto("180"));
  d = demo.addProduct(d, "Landing page build", nearToYocto("95"));
  d = demo.addProduct(d, "Monthly support retainer", nearToYocto("40"));

  const paid = demo.createInvoice(
    d,
    1,
    [
      { description: "Brand identity sprint", quantity: 1, unit_price: nearToYocto("180") },
      { description: "Landing page build", quantity: 1, unit_price: nearToYocto("95") },
    ],
    21,
  );
  d = demo.setStatus(paid.dashboard, paid.invoice.id, "Sent");
  d = demo.payInvoice(d, paid.invoice.id);

  const sent = demo.createInvoice(
    d,
    2,
    [{ description: "Monthly support retainer", quantity: 2, unit_price: nearToYocto("40") }],
    14,
  );
  d = demo.setStatus(sent.dashboard, sent.invoice.id, "Sent");

  const draft = demo.createInvoice(
    d,
    3,
    [{ description: "Landing page build", quantity: 1, unit_price: nearToYocto("95") }],
    30,
  );
  d = draft.dashboard;

  return d;
}
