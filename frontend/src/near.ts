import type { Action, Wallet, WalletSelector } from "@near-wallet-selector/core";
import type { WalletSelectorModal } from "@near-wallet-selector/modal-ui";
import type { Business, Dashboard, Invoice, InvoiceItemInput } from "./types";

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

/**
 * Wallets that live inside the browser (extensions) expose a global. When one
 * is already installed and unlocked we connect to it directly instead of
 * opening the wallet-selector modal, so no extra wallet tab is opened.
 */
const INJECTED_WALLETS: Array<{
  id: string;
  name: string;
  detect: (w: any) => boolean;
}> = [
  {
    id: "meteor-wallet",
    name: "Meteor Wallet",
    detect: (w) => Boolean(w.meteorWallet || w.meteorCom),
  },
  {
    id: "nightly",
    name: "Nightly",
    detect: (w) => Boolean(w.nightly?.near || w.nightly?.isNightly),
  },
  {
    id: "sender",
    name: "Sender",
    detect: (w) => Boolean(w.near?.isSender),
  },
  {
    id: "here-wallet",
    name: "HERE Wallet",
    detect: (w) => Boolean(w.hotExtension || w.hereWallet),
  },
];

/** The wallet-selector id of the wallet the user connected with last time. */
function lastWalletId(): string | null {
  try {
    // Wallet Selector stores JSON, so a wallet id is saved as `"meteor-wallet"`.
    const raw = localStorage.getItem("near-wallet-selector:selectedWalletId");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed === "string" ? parsed : null;
  } catch {
    return null;
  }
}

export function detectInjectedWallet(): { id: string; name: string } | null {
  const w = window as any;
  const installed = INJECTED_WALLETS.filter((item) => {
    try {
      return item.detect(w);
    } catch {
      return false;
    }
  });
  if (!installed.length) return null;

  // Prefer whichever extension the user connected with previously.
  const last = lastWalletId();
  const preferred = installed.find((item) => item.id === last) ?? installed[0];
  return { id: preferred.id, name: preferred.name };
}

let connecting: Promise<string | null> | null = null;

export async function connectWallet(): Promise<string | null> {
  // De-duplicate concurrent connect attempts so one click can never open
  // multiple wallet popups / re-open the Meteor window repeatedly.
  if (connecting) return connecting;

  const run = (async (): Promise<string | null> => {
    const s = await initWallet();
    if (s.isSignedIn()) {
      wallet = await s.wallet();
      return s.store.getState().accounts[0]?.accountId ?? null;
    }

    // Use the wallet that is already activated in this browser, if any.
    const installed = detectInjectedWallet();
    if (installed) {
      try {
        const injected = await s.wallet(installed.id);
        // The detected wallets are always injected; the union type is wider.
        const accounts = await (injected as any).signIn({ contractId: CONTRACT_ID });
        wallet = injected;
        const accountId =
          accounts?.[0]?.accountId ?? s.store.getState().accounts[0]?.accountId ?? null;
        if (accountId) return accountId;
      } catch {
        // Extension not ready or the user dismissed it — fall back to the modal.
      }
    }

    modal?.show();
    return null;
  })();

  connecting = run;
  try {
    return await run;
  } finally {
    connecting = null;
  }
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
  return rpcView(CONTRACT_ID, method, args);
}

/** View-call any contract (used for fungible-token metadata and balances). */
export async function viewOn<T>(
  contractId: string,
  method: string,
  args: Record<string, unknown>,
): Promise<T> {
  return rpcView(contractId, method, args);
}

/**
 * JSON-RPC view call with a small retry loop — public testnet RPC
 * occasionally drops requests, and a silent failure would degrade the UI.
 */
async function rpcView<T>(account_id: string, method: string, args: Record<string, unknown>): Promise<T> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 700));
    }
    try {
      const res = await fetch(RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "near-business-manager",
          method: "query",
          params: {
            request_type: "call_function",
            finality: "final",
            account_id,
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
    } catch (e) {
      lastError = e;
      if (e instanceof Error && /panic|Invoice|business|memo|not accepted/i.test(e.message)) {
        throw e; // Contract-level errors are not worth retrying.
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("RPC error");
}

export async function fetchDashboard(accountId: string): Promise<Dashboard | null> {
  return view<Dashboard | null>("get_dashboard", { account_id: accountId });
}

export async function getInvoice(ownerId: string, invoiceId: number): Promise<Invoice | null> {
  return view<Invoice | null>("get_invoice", { account_id: ownerId, invoice_id: invoiceId });
}

export async function getBusiness(accountId: string): Promise<Business | null> {
  return view<Business | null>("get_business", { account_id: accountId });
}

export type FtMetadata = {
  symbol: string;
  decimals: number;
  name?: string;
};

export async function getFtMetadata(token: string): Promise<FtMetadata | null> {
  try {
    return await rpcView<FtMetadata>(token, "ft_metadata", {});
  } catch {
    return null;
  }
}

type CallOptions = {
  args?: Record<string, unknown>;
  deposit?: string;
  gas?: string;
  /** Target contract; defaults to the business contract. */
  receiverId?: string;
};

export async function callContract(method: string, options: CallOptions = {}) {
  const s = await initWallet();
  if (!wallet) wallet = await s.wallet();
  const accountId = s.store.getState().accounts[0]?.accountId;
  if (!accountId) throw new Error("Connect a NEAR wallet first");

  const result = await wallet.signAndSendTransaction({
    signerId: accountId,
    receiverId: options.receiverId ?? CONTRACT_ID,
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

/**
 * Several contract calls bundled into ONE transaction — the wallet asks for
 * approval exactly once and all actions execute atomically in order. Used by
 * the one-approval workspace setup (business + customers + products + invoices
 * in a single signature).
 *
 * Total attached gas across actions must stay under the ~300 Tgas
 * per-transaction cap, so each simple call carries a small budget.
 */
type BatchOp = {
  method: string;
  args?: Record<string, unknown>;
  deposit?: string;
  gas?: string;
};

export async function callContractBatch(ops: BatchOp[]) {
  const s = await initWallet();
  if (!wallet) wallet = await s.wallet();
  const accountId = s.store.getState().accounts[0]?.accountId;
  if (!accountId) throw new Error("Connect a NEAR wallet first");

  const result = await wallet.signAndSendTransaction({
    signerId: accountId,
    receiverId: CONTRACT_ID,
    actions: ops.map((op) =>
      signAction!(
        op.method,
        op.args ?? {},
        BigInt(op.gas ?? "20000000000000"),
        BigInt(op.deposit ?? "0"),
      ),
    ),
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

  /** Pay an invoice with the business's accepted fungible token. */
  payInvoiceFt: (owner_id: string, invoice_id: number, token: string, amount: string) =>
    callContract("ft_transfer_call", {
      args: {
        receiver_id: CONTRACT_ID,
        amount,
        msg: `pay:${owner_id}:${invoice_id}`,
      },
      receiverId: token,
      deposit: "1",
      gas: "300000000000000",
    }),

  /** Tell the contract which token this business accepts (owner only). */
  setAcceptedToken: (token: string, decimals: number) =>
    callContract("set_accepted_token", { args: { token, decimals } }),

  clearAcceptedToken: () => callContract("clear_accepted_token", { args: {} }),

  /** Withdraw token payments held by the contract (owner only). */
  withdrawFt: (token: string) =>
    callContract("withdraw_ft", {
      args: { token },
      deposit: "1",
      gas: "300000000000000",
    }),

  getFtBalance: (owner_id: string, token: string) =>
    view<string>("get_ft_balance", { owner_id, token }),

  /**
   * One-approval workspace setup: business profile, all customers, all
   * products and every invoice in a single batched transaction. Invoice ids
   * are assigned sequentially (1, 2, …) so status/payment steps can reference
   * them by position.
   */
  setupWorkspace: async (spec: {
    business: { name: string; handle: string; email: string; currency: string; tax_bps: number };
    customers: Array<{ name: string; email: string }>;
    products: Array<{ name: string; price_yocto: string }>;
    invoices: Array<{
      customer_id: number;
      items: Array<{ description: string; quantity: number; unit_price: string }>;
      due_days: number;
      status?: "Sent";
      pay?: boolean;
    }>;
  }) => {
    const s = await initWallet();
    if (!wallet) wallet = await s.wallet();
    const accountId = s.store.getState().accounts[0]?.accountId;
    if (!accountId) throw new Error("Connect a NEAR wallet first");

    const ops: Array<{ method: string; args?: Record<string, unknown>; deposit?: string; gas?: string }> = [
      {
        method: "create_business",
        args: {
          name: spec.business.name,
          handle: spec.business.handle,
          email: spec.business.email,
          currency: spec.business.currency,
          tax_bps: spec.business.tax_bps,
        },
      },
      ...spec.customers.map((c) => ({
        method: "add_customer",
        args: { name: c.name, email: c.email },
      })),
      ...spec.products.map((p) => ({
        method: "add_product",
        args: { name: p.name, price: p.price_yocto },
      })),
    ];

    spec.invoices.forEach((inv, index) => {
      const invoiceId = index + 1; // ids start at 1 and increment per business
      ops.push({
        method: "create_invoice",
        args: { customer_id: inv.customer_id, items: inv.items, due_days: inv.due_days },
      });
      if (inv.status) {
        ops.push({ method: "set_invoice_status", args: { invoice_id: invoiceId, status: inv.status } });
      }
      if (inv.pay) {
        // Mirror the contract's math: total = subtotal + floor(subtotal * tax / 10000).
        const subtotal = inv.items.reduce(
          (acc, it) => acc + BigInt(it.unit_price) * BigInt(it.quantity),
          0n,
        );
        const total = subtotal + (subtotal * BigInt(spec.business.tax_bps)) / 10000n;
        ops.push({
          method: "pay_invoice",
          args: { owner_id: accountId, invoice_id: invoiceId },
          deposit: total.toString(),
          gas: "60000000000000",
        });
      }
    });

    return callContractBatch(ops);
  },
};
