/**
 * Google sign-in powered by NEAR Auth (testnet), using the standard
 * @auth0/auth0-spa-js client directly — no protocol SDKs needed.
 *
 * Sign-in works like this:
 *   1. Auth0 popup → the user signs in with Google (or any enabled identity).
 *   2. We read the `sub` claim from the returned ID token.
 *   3. We ask the NEAR MPC contract (derived_public_key view call on
 *      v1.signer-prod.testnet) for the key derived from the user's identity.
 *      The path is `jwt#https://{domain}/#{sub}`, exactly like NEAR Auth does.
 *
 * The guest flow proves *who* is opening the invoice. The final payment is
 * still settled via the customer's NEAR wallet, because the browser SDKs for
 * universal account creation don't ship in JS yet.
 *
 * Shared testnet client allowlist note: the NEAR Auth shared testnet Auth0 app
 * only whitelists http://localhost:3000 as a callback origin. On other origins
 * the popup would be rejected by Auth0, so the UI offers its own Auth0 tenant
 * via VITE_FAST_AUTH_CLIENT_ID (+ optional domain / signing audience).
 */

const RPC_URL = "https://rpc.testnet.near.org";
const MPC_CONTRACT = "v1.signer-prod.testnet";
const NEAR_AUTH_CONTRACT = "fast-auth.testnet";

// NEAR Auth testnet shared development credentials — do not ship for mainnet.
const SHARED_TESTNET_CLIENT_ID = "np8paqIpMWmNbzT4xAvOOapZBjsOpptl";
const DEFAULT_AUTH0_DOMAIN = "login.testnet.fast-auth.com";
const DEFAULT_SIGNING_AUDIENCE = "auth0.jwt.fast-auth.testnet";

export type GuestSession = {
  publicKey: string;
};

type Auth0Client = {
  loginWithPopup: (...args: unknown[]) => Promise<void>;
  getIdTokenClaims: () => Promise<{ sub?: string } | undefined>;
  logout: (options?: { logoutParams?: { returnTo?: string } }) => Promise<void>;
};

let clientPromise: Promise<Auth0Client> | null = null;

function auth0Options() {
  const clientId = (import.meta as any).env?.VITE_FAST_AUTH_CLIENT_ID || SHARED_TESTNET_CLIENT_ID;
  const domain = (import.meta as any).env?.VITE_FAST_AUTH_DOMAIN || DEFAULT_AUTH0_DOMAIN;
  const audience =
    (import.meta as any).env?.VITE_FAST_AUTH_SIGNING_AUDIENCE || DEFAULT_SIGNING_AUDIENCE;
  return {
    domain,
    clientId,
    audience,
    cacheLocation: "memory" as const,
    authorizationParams: {
      audience,
      scope: "openid profile email",
      redirect_uri: window.location.origin,
    },
  };
}

/** True when this origin is allowed by the configured Auth0 application. */
export function guestSignInAvailable(): boolean {
  if ((import.meta as any).env?.VITE_FAST_AUTH_CLIENT_ID) {
    // Own tenant: we assume its allowlist includes this origin.
    return true;
  }
  try {
    return ["http://localhost:3000", "http://127.0.0.1:3000"].includes(window.location.origin);
  } catch {
    return false;
  }
}

async function getClient(): Promise<Auth0Client> {
  if (clientPromise) return clientPromise;
  const opts = auth0Options();
  clientPromise = import("@auth0/auth0-spa-js").then(({ createAuth0Client }) => {
    // The library's own overloads differ slightly by cacheLocation; the
    // object above is valid for the default "memory" mode.
    return createAuth0Client(opts as never) as unknown as Promise<Auth0Client>;
  });
  return clientPromise;
}

async function derivePublicKey(path: string): Promise<string> {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "guest-checkout",
      method: "query",
      params: {
        request_type: "call_function",
        finality: "final",
        account_id: MPC_CONTRACT,
        method_name: "derived_public_key",
        args_base64: btoa(
          JSON.stringify({
            path,
            predecessor: NEAR_AUTH_CONTRACT,
            domain_id: 1, // ed25519
          }),
        ),
      },
    }),
  });
  const json = await res.json();
  if (json.error) {
    throw new Error(json.error.message || "NEAR RPC error");
  }
  const bytes: number[] = json.result?.result ?? [];
  const text = new TextDecoder().decode(new Uint8Array(bytes));
  return JSON.parse(text) as string;
}

/** Open the Auth0 popup and derive the customer's public key. */
export async function guestSignIn(): Promise<GuestSession> {
  const client = await getClient();
  await client.loginWithPopup();

  const claims = await client.getIdTokenClaims();
  const sub = claims?.sub;
  if (!sub) {
    throw new Error("Sign-in completed but no identity was returned by Auth0.");
  }

  const domain = (import.meta as any).env?.VITE_FAST_AUTH_DOMAIN || DEFAULT_AUTH0_DOMAIN;
  const publicKey = await derivePublicKey(`jwt#https://${domain}/#${sub}`);
  return { publicKey };
}

/** End the Auth0 session and return to the checkout page. */
export async function guestSignOut(): Promise<void> {
  const client = await getClient();
  await client.logout({
    logoutParams: { returnTo: window.location.origin + window.location.pathname + window.location.search },
  });
}
