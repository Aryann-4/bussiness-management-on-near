/**
 * Celebration burst when an invoice is paid. Lazy-loaded so the demo
 * bundle stays small; requires the `canvas-confetti` package.
 */

export function celebratePayment() {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  import("canvas-confetti").then(({ default: confetti }) => {
    const origin = { x: 0.5, y: 0.75 };
    confetti({
      particleCount: 60,
      spread: 75,
      angle: 60,
      origin: { x: 0.1, y: 0.85 },
      colors: ["#4f46e5", "#4ade9a", "#fbbf24", "#8b5cf6"],
    });
    confetti({
      particleCount: 60,
      spread: 75,
      angle: 120,
      origin: { x: 0.9, y: 0.85 },
      colors: ["#4f46e5", "#4ade9a", "#fbbf24", "#8b5cf6"],
    });
    confetti({
      particleCount: 90,
      spread: 100,
      origin,
      colors: ["#4f46e5", "#6d5ef0", "#4ade9a", "#fbbf24", "#38bdf8"],
      disableForReducedMotion: true,
    });
  });
}
