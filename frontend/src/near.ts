import { setupWalletSelector } from "@near-wallet-selector/core";
import { setupMyNearWallet } from "@near-wallet-selector/my-near-wallet";
import { setupModal } from "@near-wallet-selector/modal-ui";
import "@near-wallet-selector/modal-ui/styles.css";
import type { Dashboard, InvoiceItemInput } from "./types";

export const CONTRACT_ID =
  (import.meta as any).env?.VITE_CONTRACT_ID || "near-business-manager.testnet";
export const NETWORK = "testnet";
export const RPC_URL = "https://rpc.testnet.near.org";

type Selector = Awaited<ReturnType<typeof setupWalletSelector>>;
type Wallet = Awaited<ReturnType<Selector["wallet"]>>;

let selector: Selector | null = null;
let modal: ReturnType<typeof setupModal> | null = null;
let wallet: Wallet | null = null;

export async function initWallet() {
  if (selector) return selector;
  selector = await setupWalletSelector({
    network: NETWORK,
    modules: [setupMyNearWallet()],
  });
  modal = setupModal(selector, { contractId: CONTRACT_ID });
  return selector;
}

export async function connectWallet(): Promise<string | null> {
  const s = await initWallet();
  if (s.isSignedIn()) {
    wallet = await s.wallet();
    return s.store.getState().accounts[0]?.accountId ?? null;
  }
  modal?.show();
  return null;
}

export async function showWalletModal(): Promise<void> {
  await initWallet();
  modal?.show();
}

export async function restoreWallet(): Promise<string | null> {
  const s = await initWallet();
  if (!s.isSignedIn()) return null;
  wallet = await s.wallet();
  return s.store.getState().accounts[0]?.accountId ?? null;
}

export async function disconnectWallet() {
  const s = await initWallet();
  wallet = await s.wallet();
  await wallet.signOut();
  wallet = null;
}

async function view<T>(method: string, args: Record<string, unknown>): Promise<T> {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "near-business-manager",
      method: "query",
      params: {
        request_type: "call",
        finality: "final",
        account_id: CONTRACT_ID,
        method_name: method,
        args_base64: btoa(JSON.stringify(args)),
      },
    }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || "RPC error");
  const bytes = json.result?.result ?? [];
  const text = new TextDecoder().decode(new Uint8Array(bytes));
  return JSON.parse(text) as T;
}

export async function fetchDashboard(accountId: string): Promise<Dashboard | null> {
  return view<Dashboard | null>("get_dashboard", { account_id: accountId });
}

type CallOptions = {
  args?: Record<string, unknown>;
  deposit?: string;
  gas?: string;
};

export async function callContract(method: string, options: CallOptions = {}) {
  const s = await initWallet();
  if (!wallet) wallet = await s.wallet();
  const accountId = s.store.getState().accounts[0]?.accountId;
  if (!accountId) throw new Error("Connect a NEAR wallet first");

  const result = await wallet.signAndSendTransaction({
    signerId: accountId,
    receiverId: CONTRACT_ID,
    actions: [
      {
        type: "FunctionCall",
        params: {
          methodName: method,
          args: options.args ?? {},
          gas: options.gas ?? "100000000000000",
          deposit: options.deposit ?? "0",
        },
      },
    ],
  });
  return result;
}

// -- typed helpers ---------------------------------------------------------

export const live = {
  createBusiness: (input: {
    name: string;
    handle: string;
    email: string;
    currency: string;
    tax_bps: number;
  }) =>
    callContract("create_business", {
      args: {
        name: input.name,
        handle: input.handle,
        email: input.email,
        currency: input.currency,
        tax_bps: input.tax_bps,
      },
    }),

  updateBusiness: (input: {
    name: string;
    handle: string;
    email: string;
    currency: string;
    tax_bps: number;
  }) => callContract("update_business", { args: input }),

  addCustomer: (name: string, email: string) =>
    callContract("add_customer", { args: { name, email } }),

  removeCustomer: (customer_id: number) =>
    callContract("remove_customer", { args: { customer_id } }),

  addProduct: (name: string, price: string) =>
    callContract("add_product", { args: { name, price } }),

  toggleProduct: (product: { id: number; name: string; price: string; active: boolean }) =>
    callContract("update_product", {
      args: {
        product_id: product.id,
        name: product.name,
        price: product.price,
        active: !product.active,
      }
    }),

  removeProduct: (product_id: number) =>
    callContract("remove_product", { args: { product_id } }),

  createInvoice: (customer_id: number, items: InvoiceItemInput[], due_days: number) =>
    callContract("create_invoice", {
      args: { customer_id, items, due_days },
    }),

  setStatus: (invoice_id: number, status: string) =>
    callContract("set_invoice_status", { args: { invoice_id, status } }),

  payInvoice: (owner_id: string, invoice_id: number, total: string) =>
    callContract("pay_invoice", {
      args: { owner_id, invoice_id },
      deposit: total,
      gas: "100000000000000",
    }),
};
