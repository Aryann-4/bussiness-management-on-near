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
