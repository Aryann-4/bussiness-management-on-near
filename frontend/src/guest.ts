/**
 * Google sign-in powered by NEAR Auth (testnet).
 *
 * Limited on purpose: the shared NEAR Auth testnet Auth0 app only whitelists
 * the `http://localhost:3000` callback, so the popup works from a locally-run
 * dev/preview server on port 3000. On any other origin the popup opens but
 * Auth0 rejects the redirect — so the UI shows a note instead of pretending
 * to work.
 *
 * To use your own Auth0 tenant, set VITE_FAST_AUTH_CLIENT_ID (and optionally
 * VITE_FAST_AUTH_DOMAIN / VITE_FAST_AUTH_SIGNING_AUDIENCE) at build time.
 */

// NEAR Auth testnet shared development credentials — do not ship for mainnet.
const SHARED_TESTNET_CLIENT_ID = "np8paqIpMWmNbzT4xAvOOapZBjsOpptl";
const FAST_AUTH_CONTRACT = "fast-auth.testnet";
const MPC_CONTRACT = "v1.signer-prod.testnet";
const RPC_URL = "https://rpc.testnet.near.org";
const DEFAULT_ALLOWED_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"];

export type GuestSession = {
  publicKey: string;
};

type Loaded = {
  signIn: () => Promise<GuestSession>;
  signOut: () => Promise<void>;
};

let loaded: Loaded | null = null;

function env(name: string): string | undefined {
  return (import.meta as any).env?.[name];
}

/** True when this origin is allowed by the configured Auth0 application. */
export function guestSignInAvailable(): boolean {
  if (env("VITE_FAST_AUTH_CLIENT_ID")) return true; // own tenant wins
  try {
    return DEFAULT_ALLOWED_ORIGINS.includes(window.location.origin);
  } catch {
    return false;
  }
}

async function getClient(): Promise<Loaded> {
  if (loaded) return loaded;

  const [{ FastAuthClient }, { JavascriptProvider }, nearApi] = await Promise.all([
    import("@fast-auth-near/browser-sdk"),
    import("@fast-auth-near/javascript-provider"),
    import("near-api-js"),
  ]);

  const clientId = env("VITE_FAST_AUTH_CLIENT_ID") || SHARED_TESTNET_CLIENT_ID;

  const provider = new JavascriptProvider({
    network: "testnet",
    clientId,
    ...(env("VITE_FAST_AUTH_DOMAIN") ? { domain: env("VITE_FAST_AUTH_DOMAIN") } : {}),
    ...(env("VITE_FAST_AUTH_SIGNING_AUDIENCE")
      ? { signingAudience: env("VITE_FAST_AUTH_SIGNING_AUDIENCE") }
      : {}),
  });

  // The SDK only uses connection.provider.query/sendTransaction, so a
  // JsonRpcProvider is enough and avoids pulling in near-api-js's old
  // (v5) `Connection` shape.
  const rpc = new nearApi.JsonRpcProvider({ url: RPC_URL });
  const connection = { provider: rpc } as any;

  const client = new FastAuthClient(provider, connection, {
    fastAuthContractId: FAST_AUTH_CONTRACT,
    mpcContractId: MPC_CONTRACT,
  });

  loaded = {
    signIn: async () => {
      await client.login(); // opens an Auth0 popup window
      const signer = await client.getSigner();
      const publicKey = await signer.getPublicKey();
      return { publicKey: publicKey.toString() };
    },
    signOut: async () => {
      try {
        await client.logout();
      } catch {
        /* best effort */
      }
    },
  };

  return loaded;
}

/** Open the Auth0 popup. Resolves with the user's derived public key. */
export async function guestSignIn(): Promise<GuestSession> {
  const { signIn } = await getClient();
  return signIn();
}

export async function guestSignOut(): Promise<void> {
  const { signOut } = await getClient();
  return signOut();
}
