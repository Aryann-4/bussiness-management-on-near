import type { Action, Wallet, WalletSelector } from "@near-wallet-selector/core";
import type { WalletSelectorModal } from "@near-wallet-selector/modal-ui";
import type { Dashboard, InvoiceItemInput } from "./types";

export const CONTRACT_ID =
  (import.meta as any).env?.VITE_CONTRACT_ID || "near-business-manager.testnet";
export const NETWORK = "testnet";
export const RPC_URL = "https://rpc.testnet.near.org";

let selector: WalletSelector | null = null;
let modal: WalletSelectorModal | null = null;
let wallet: Wallet | null = null;
let signAction:
  | ((methodName: string, args: object, gas?: bigint, deposit?: bigint) => Action)
  | null = null;

/**
 * Wallet libraries are large, so they are loaded on demand. Opening the app in
 * demo mode never downloads them — only switching to live mode does.
 */
export async function initWallet(): Promise<WalletSelector> {
  if (selector) return selector;

  const [core, modalUi, myNear, meteor, here, nightly, sender] = await Promise.all([
    import("@near-wallet-selector/core"),
    import("@near-wallet-selector/modal-ui"),
    import("@near-wallet-selector/my-near-wallet"),
    import("@near-wallet-selector/meteor-wallet"),
    import("@near-wallet-selector/here-wallet"),
    import("@near-wallet-selector/nightly"),
    import("@near-wallet-selector/sender"),
    import("@near-wallet-selector/modal-ui/styles.css"),
  ]);

  signAction = core.actionCreators.functionCall as typeof signAction;

  selector = await core.setupWalletSelector({
    network: NETWORK,
    modules: [
      myNear.setupMyNearWallet(),
      meteor.setupMeteorWallet(),
      here.setupHereWallet(),
      nightly.setupNightly(),
      sender.setupSender(),
    ],
  });

  modal = modalUi.setupModal(selector, {
    contractId: CONTRACT_ID,
    theme: document.documentElement.dataset.theme === "dark" ? "dark" : "light",
    description: "Choose a NEAR testnet wallet to connect. Your keys never leave your wallet.",
  });

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
      signAction!(
        method,
        options.args ?? {},
        BigInt(options.gas ?? "100000000000000"),
        BigInt(options.deposit ?? "0"),
      ),
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
      },
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
