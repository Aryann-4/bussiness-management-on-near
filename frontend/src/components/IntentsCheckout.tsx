import { useEffect, useRef, useState } from "react";
import { formatNear } from "../money";
import { Icon } from "./Icon";

/**
 * Cross-chain checkout powered by the NEAR Intents 1Click API
 * (https://1click.chaindefuser.com). The customer pays from any supported
 * chain (Ethereum, Base, Arbitrum, Bitcoin, Solana, …); market makers compete
 * to fill the swap and the exact invoice total in wNEAR settles on NEAR.
 *
 * Flow (ORIGIN_CHAIN deposits):
 *   1. quote  — POST /v0/quote (EXACT_OUTPUT: "exactly the invoice total")
 *   2. pay    — the user sends the quoted token amount to the quote's
 *               dedicated deposit address from any wallet
 *   3. track  — GET /v0/status?depositAddress=… until SUCCESS
 */

const ONECLICK = "https://1click.chaindefuser.com";

type Token = {
  assetId: string;
  symbol: string;
  blockchain: string;
  decimals: number;
  price: string;
};

/** Popular payment tokens shown first; the rest of the list is alphabetized. */
const FEATURED = new Set([
  "nep141:eth.omft.near",
  "nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near", // USDC (eth)
  "nep141:eth-0xdac17f958d2ee523a2206206994597c13d831ec7.omft.near", // USDT (eth)
  "nep141:btc.omft.near",
  "nep141:sol.omft.near",
  "nep141:base-0x4200000000000000000000000000000000000006.omft.near", // ETH (base)
  "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near", // USDC (base)
  "nep141:arb-0xaf88d065e77c8cc2239327c5edb3a432268e5831.omft.near", // USDC (arb)
]);

const CHAIN_LABEL: Record<string, string> = {
  eth: "Ethereum",
  base: "Base",
  arb: "Arbitrum",
  btc: "Bitcoin",
  sol: "Solana",
  near: "NEAR",
  polygon: "Polygon",
  ava: "Avalanche",
  doge: "Dogecoin",
  xrp: "XRP",
  trx: "Tron",
  ton: "TON",
};

type Quote = {
  quote: {
    amountIn: string;
    amountInFormatted: string;
    minAmountIn: string;
    amountOut: string;
    timeEstimate: number;
  };
};

type SwapStatus = {
  status: string;
  quote?: { amountIn?: string; amountInUsd?: string };
  depositAddress?: string;
};

const STATUS_STEP: Record<string, number> = {
  PENDING_DEPOSIT: 1,
  KNOWN_DEPOSIT_TX: 2,
  PROCESSING: 3,
  SUCCESS: 4,
  INCOMPLETE_DEPOSIT: 1,
  REFUNDED: 0,
  FAILED: 0,
};

const STATUS_TEXT: Record<string, string> = {
  PENDING_DEPOSIT: "Waiting for your deposit…",
  KNOWN_DEPOSIT_TX: "Deposit detected — confirming…",
  PROCESSING: "Swap executing on NEAR Intents…",
  SUCCESS: "Swap complete! NEAR delivered.",
  INCOMPLETE_DEPOSIT: "Deposit received, but below the quoted amount.",
  REFUNDED: "Swap failed — funds refunded to your refund address.",
  FAILED: "Swap failed.",
};

export default function IntentsCheckout({
  ownerId,
  totalYocto,
}: {
  ownerId: string;
  totalYocto: string;
}) {
  const [tokens, setTokens] = useState<Token[] | null>(null);
  const [origin, setOrigin] = useState<Token | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [depositAddress, setDepositAddress] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<number | null>(null);

  // Load the token list once (chain assets come from anywhere, destination
  // is always wNEAR on NEAR).
  useEffect(() => {
    let cancelled = false;
    fetch(`${ONECLICK}/v0/tokens`)
      .then((r) => r.json())
      .then((all: Token[]) => {
        if (cancelled) return;
        const payable = all
          .filter((t) => t.blockchain !== "near")
          .sort((a, b) => {
            const fa = FEATURED.has(a.assetId) ? 0 : 1;
            const fb = FEATURED.has(b.assetId) ? 0 : 1;
            return fa - fb || a.blockchain.localeCompare(b.blockchain) || a.symbol.localeCompare(b.symbol);
          });
        setTokens(payable);
        setOrigin(payable[0] ?? null);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load supported tokens. Try again shortly.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Poll swap status while a quote is active.
  useEffect(() => {
    if (!depositAddress || status === "SUCCESS" || status === "REFUNDED" || status === "FAILED") return;
    const tick = async () => {
      try {
        const r = await fetch(`${ONECLICK}/v0/status?depositAddress=${encodeURIComponent(depositAddress)}`);
        const j: SwapStatus = await r.json();
        if (j?.status) setStatus(j.status);
      } catch {
        /* keep last known status */
      }
    };
    void tick();
    pollRef.current = window.setInterval(tick, 8000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [depositAddress, status]);

  const requestQuote = async () => {
    if (!origin) return;
    setLoading(true);
    setError(null);
    setQuote(null);
    setDepositAddress(null);
    setStatus(null);
    try {
      const res = await fetch(`${ONECLICK}/v0/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dry: false,
          swapType: "EXACT_OUTPUT", // deliver exactly the invoice total in NEAR
          slippageTolerance: 300, // 3%
          originAsset: origin.assetId,
          depositType: "ORIGIN_CHAIN",
          destinationAsset: "nep141:wrap.near",
          amount: totalYocto, // invoice total in yoctoNEAR (wNEAR, 24 dec)
          recipient: ownerId,
          recipientType: "INTENTS",
          refundTo: ownerId,
          refundType: "INTENTS",
          deadline: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        }),
      });
      const j = await res.json();
      if (!res.ok || !j?.quote) {
        setError(
          typeof j?.message === "string" && j.message
            ? `No quote right now (${j.message}). Try a moment later or another token.`
            : "No quote right now — try again shortly.",
        );
        return;
      }
      setQuote(j);
      const addr = j?.quote?.depositAddress;
      if (typeof addr === "string") setDepositAddress(addr);
      else setError("Quote received but no deposit address was returned.");
    } catch {
      setError("Could not reach the NEAR Intents network. Please retry.");
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!depositAddress) return;
    try {
      await navigator.clipboard.writeText(depositAddress);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const step = status ? STATUS_STEP[status] ?? 0 : 0;
  const originLabel = origin ? `${origin.symbol} (${CHAIN_LABEL[origin.blockchain] ?? origin.blockchain})` : "—";

  return (
    <div className="intents-widget-wrap">
      <p className="hint center" style={{ marginBottom: 12 }}>
        Pay from any chain — Ethereum, Base, Bitcoin, Solana and 20+ more. NEAR
        Intents market makers compete to fill your swap, and the exact invoice
        total settles on NEAR for the business.
      </p>

      <label className="field-label" htmlFor="intents-token">
        Pay with
      </label>
      <select
        id="intents-token"
        className="input intents-token-select"
        value={origin?.assetId ?? ""}
        onChange={(e) => {
          setOrigin(tokens?.find((t) => t.assetId === e.target.value) ?? null);
          setQuote(null);
          setDepositAddress(null);
          setStatus(null);
        }}
      >
        {tokens === null && <option>Loading tokens…</option>}
        {tokens?.map((t) => (
          <option key={t.assetId} value={t.assetId}>
            {t.symbol} — {CHAIN_LABEL[t.blockchain] ?? t.blockchain}
          </option>
        ))}
      </select>

      {invoiceHint(totalYocto)}

      <button
        type="button"
        className="btn primary block"
        style={{ marginTop: 12 }}
        onClick={requestQuote}
        disabled={loading || !origin || !tokens}
      >
        <Icon name="globe" size={16} />
        {loading ? "Requesting quote…" : `Quote ${originLabel} → NEAR`}
      </button>

      {error && (
        <div className="empty" style={{ marginTop: 12 }}>
          <div className="empty-icon">
            <Icon name="info" size={20} />
          </div>
          <div className="empty-title">{error}</div>
        </div>
      )}

      {quote?.quote && (
        <div className="intents-quote">
          <div className="intents-quote-row">
            <span>You send</span>
            <strong className="mono">
              {quote.quote.amountInFormatted} {origin?.symbol}
            </strong>
          </div>
          <div className="intents-quote-row">
            <span>Business receives</span>
            <strong className="mono">{formatNear(quote.quote.amountOut, undefined)}</strong>
          </div>
          <div className="intents-quote-row">
            <span>Settlement time</span>
            <strong>~{quote.quote.timeEstimate}s</strong>
          </div>
        </div>
      )}

      {depositAddress && (
        <div className="intents-deposit">
          <p className="field-label">
            Send the exact amount above to this NEAR Intents deposit address
            (any wallet works):
          </p>
          <div className="intents-deposit-row">
            <code className="mono">{depositAddress}</code>
            <button type="button" className="btn ghost sm" onClick={copy}>
              <Icon name={copied ? "check" : "copy"} size={13} />
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {status && (
        <div className="intents-status">
          <div className="intents-steps" aria-hidden>
            {[1, 2, 3, 4].map((n) => (
              <span
                key={n}
                className={`intents-step ${step >= n ? "done" : ""} ${n === step ? "now" : ""}`}
              />
            ))}
          </div>
          <p className={`hint center ${status === "SUCCESS" ? "success" : ""}`}>
            {STATUS_TEXT[status] ?? status}
          </p>
        </div>
      )}

      <p className="hint center" style={{ marginTop: 10 }}>
        Powered by NEAR Intents (1Click). The swapped wNEAR lands in the
        business's NEAR Intents balance — one click in any NEAR wallet claims it.
      </p>
    </div>
  );
}

function invoiceHint(totalYocto: string) {
  return (
    <p className="hint center" style={{ marginTop: 8 }}>
      Invoice total: <span className="mono">{formatNear(totalYocto, undefined)}</span> — the
      quote is exact, no NEAR needed in your wallet.
    </p>
  );
}
