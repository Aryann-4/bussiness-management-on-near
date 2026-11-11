/**
 * Brand mark: three rising bars with a growth arrow and a small NEAR coin.
 * The tile background is provided by `.brand-mark` so it can adapt to themes.
 */
export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      role="img"
      aria-label="NEAR Business Manager logo"
    >
      <rect x="5" y="18.5" width="4.2" height="8" rx="2.1" fill="#fff" opacity="0.72" />
      <rect x="12.1" y="14" width="4.2" height="12.5" rx="2.1" fill="#fff" opacity="0.9" />
      <rect x="19.2" y="19.5" width="4.2" height="7" rx="2.1" fill="#fff" opacity="0.72" />
      <path
        d="M5.6 14.6 11.4 8.9l3.6 3 7.2-7"
        stroke="#7ef0c4"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18.2 4.6h5.4v5.2"
        stroke="#7ef0c4"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="26.6" cy="25.6" r="2.5" fill="#7ef0c4" opacity="0.9" />
      <path
        d="M25.4 26.6v-2l2.3 2.4v-2"
        stroke="#4f46e5"
        strokeWidth="0.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
