/**
 * Google sign-in powered by NEAR Auth (testnet).
 *
 * Limited on purpose: the browser SDK can authenticate you and produce a
 * deterministic public key, but there is currently no shipped JS helper to
 * derive the `Universal Account` id from that key. So a guest cannot sign a
 * payment from an unfunded account yet — the guest flow ends by connecting
 * their NEAR wallet to actually submit the transaction.
 *
 * Runs entirely in the browser and is lazy-loaded, so it doesn't affect
 * the rest of the app's bundle.
 */

export type GuestSession = {
  publicKey: string;
};

// NEAR Auth testnet shared development credentials — do not ship for mainnet.
const SHARED_TESTNET_CLIENT_ID = "np8paqIpMWmNbzT4xAvOOapZBjsOpptl";
const FAST_AUTH_CONTRACT = "fast-auth.testnet";
const MPC_CONTRACT = "v1.signer-prod.testnet";
const RPC_URL = "https://rpc.testnet.near.org";

type Loaded = {
  signIn: () => Promise<GuestSession>;
  signOut: () => Promise<void>;
};

let loaded: Loaded | null = null;

async function getClient(): Promise<Loaded> {
  if (loaded) return loaded;

  const [{ FastAuthClient }, { JavascriptProvider }, nearApi] = await Promise.all([
    import("@fast-auth-near/browser-sdk"),
    import("@fast-auth-near/javascript-provider"),
    import("near-api-js"),
  ]);

  const provider = new JavascriptProvider({
    network: "testnet",
    clientId: SHARED_TESTNET_CLIENT_ID,
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
