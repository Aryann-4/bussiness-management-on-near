/**
 * NEAR browser libraries expect a few Node globals. Vite does not provide them,
 * so we add the small ones here before the app (or any wallet module) loads.
 * Without this, wallet setup can fail with errors like
 * "Cannot read properties of undefined (reading 'from')".
 */
import { Buffer } from "buffer";

const g = globalThis as any;

g.Buffer = g.Buffer || Buffer;
g.global = g.global || globalThis;

if (!g.process) {
  g.process = { env: {}, browser: true };
} else if (!g.process.env) {
  g.process.env = {};
}
