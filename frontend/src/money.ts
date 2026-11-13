const YOCTO_PER_NEAR = 10n ** 24n;

/** Convert a human NEAR amount ("12.5") to a yoctoNEAR string. */
export function nearToYocto(value: string): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "0";
  const [whole, fraction = ""] = trimmed.split(".");
  if (!/^\d*$/.test(whole || "0") || !/^\d*$/.test(fraction)) {
    throw new Error("Enter a valid NEAR amount");
  }
  const padded = (fraction + "0".repeat(24)).slice(0, 24);
  return ((BigInt(whole || "0") * YOCTO_PER_NEAR) + BigInt(padded || "0")).toString();
}

/** Convert a yoctoNEAR string to a readable NEAR amount. */
export function yoctoToNear(value: string | number): string {
  const yocto = BigInt(value ?? "0");
  const whole = yocto / YOCTO_PER_NEAR;
  const fraction = (yocto % YOCTO_PER_NEAR).toString().padStart(24, "0");
  const trimmed = fraction.replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed.slice(0, 6)}` : whole.toString();
}

export function formatNear(value: string | number, currency = "NEAR"): string {
  const s = yoctoToNear(value);
  const n = Number(s);
  const shown = Number.isFinite(n)
    ? n.toLocaleString(undefined, { maximumFractionDigits: 4 })
    : s;
  return `${shown} ${currency}`;
}

/**
 * Convert an invoice amount (stored at the 10^24 whole-unit scale, like
 * yoctoNEAR) into the base-unit amount of a token with `decimals` decimals.
 * Must match the contract's `total_in_token_units` (rounds up).
 */
export function totalToTokenUnits(total: string, decimals: number): string {
  const amount = BigInt(total ?? "0");
  if (decimals === 24) return amount.toString();
  if (decimals < 24) {
    const denom = 10n ** BigInt(24 - decimals);
    return ((amount + denom - 1n) / denom).toString();
  }
  const factor = 10n ** BigInt(decimals - 24);
  return (amount * factor).toString();
}

/** Format a token base-unit amount using the token's decimals. */
export function formatToken(baseUnits: string, decimals: number, symbol: string): string {
  const amount = BigInt(baseUnits ?? "0");
  const whole = amount / 10n ** BigInt(decimals);
  const fraction = (amount % 10n ** BigInt(decimals))
    .toString()
    .padStart(decimals, "0")
    .slice(0, Math.min(6, decimals));
  const trimmed = fraction.replace(/0+$/, "");
  return `${whole.toLocaleString()}${trimmed ? `.${trimmed}` : ""} ${symbol}`;
}

export function formatDate(timestamp: number): string {
  if (!timestamp) return "—";
  return new Date(timestamp / 1_000_000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function shortAccount(account: string): string {
  if (!account) return "";
  return account.length > 22 ? `${account.slice(0, 10)}…${account.slice(-8)}` : account;
}
