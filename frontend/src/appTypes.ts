import type { Dashboard } from "./types";

export type Mode = "demo" | "live";

export type Tab = "overview" | "invoices" | "customers" | "products" | "settings";

export type RunAction = {
  demo?: () => Dashboard;
  live?: () => Promise<unknown>;
};

/** Runs a mutation in the current mode and reports whether it succeeded. */
export type Run = (label: string, action: RunAction) => Promise<boolean>;

export type Toast = { kind: "success" | "error"; message: string } | null;
