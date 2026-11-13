export type InvoiceStatus = "Draft" | "Sent" | "Paid" | "Cancelled";

export interface Business {
  name: string;
  handle: string;
  email: string;
  currency: string;
  tax_bps: number;
  created_at: number;
}

export interface Customer {
  id: number;
  name: string;
  email: string;
  created_at: number;
}

export interface Product {
  id: number;
  name: string;
  /** price in yoctoNEAR as a decimal string */
  price: string;
  active: boolean;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  /** unit price in yoctoNEAR */
  unit_price: string;
  /** quantity * unit_price in yoctoNEAR */
  amount: string;
}

export interface Invoice {
  id: number;
  customer_id: number;
  items: InvoiceItem[];
  subtotal: string;
  tax: string;
  total: string;
  status: InvoiceStatus;
  created_at: number;
  due_date: number;
  paid_at: number | null;
}

export interface Dashboard {
  business: Business;
  customers: Customer[];
  products: Product[];
  invoices: Invoice[];
  revenue: string;
  accepted_token: AcceptedToken | null;
  next_customer_id: number;
  next_product_id: number;
  next_invoice_id: number;
}

/** Fungible token a business accepts for invoice payments. */
export interface AcceptedToken {
  account: string;
  decimals: number;
}

export interface Stats {
  customers: number;
  products: number;
  invoices: number;
  paid_invoices: number;
  open_invoices: number;
  revenue: string;
  outstanding: string;
}

export interface InvoiceItemInput {
  description: string;
  quantity: number;
  unit_price: string;
}
