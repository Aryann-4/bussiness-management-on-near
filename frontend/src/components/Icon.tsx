import type { CSSProperties, ReactNode } from "react";

export type IconName =
  | "home"
  | "invoice"
  | "users"
  | "box"
  | "settings"
  | "plus"
  | "check"
  | "wallet"
  | "spark"
  | "trash"
  | "send"
  | "card"
  | "close"
  | "arrow"
  | "chart"
  | "info"
  | "clock"
  | "shield";

const PATHS: Record<IconName, ReactNode> = {
  home: (
    <>
      <path d="M3.2 10.6 12 3.4l8.8 7.2" />
      <path d="M5.4 9.4V20.6h13.2V9.4" />
      <path d="M9.6 20.6v-6.2h4.8v6.2" />
    </>
  ),
  invoice: (
    <>
      <path d="M13.8 2.6H7a2 2 0 0 0-2 2v14.8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7.8z" />
      <path d="M13.8 2.6v5.2H19" />
      <path d="M8.6 12.4h6.8M8.6 16h4.6" />
    </>
  ),
  users: (
    <>
      <circle cx="9.2" cy="8.2" r="3.4" />
      <path d="M2.8 20.2c0-3.4 2.9-5.8 6.4-5.8s6.4 2.4 6.4 5.8" />
      <path d="M16.6 5.2a3.1 3.1 0 0 1 0 6" />
      <path d="M18 14.8c2.2.6 3.2 2.4 3.2 5.4" />
    </>
  ),
  box: (
    <>
      <path d="M20.8 8 12 3.2 3.2 8v8L12 20.8 20.8 16z" />
      <path d="m3.2 8 8.8 4.8L20.8 8" />
      <path d="M12 12.8v8" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M19.4 14.6a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1z" />
    </>
  ),
  plus: <path d="M12 5.2v13.6M5.2 12h13.6" />,
  check: <path d="m19.5 6.5-10.4 11L4.5 12.9" />,
  wallet: (
    <>
      <path d="M3.2 7.6A2.6 2.6 0 0 1 5.8 5h13.4a1.8 1.8 0 0 1 1.8 1.8v10.4a1.8 1.8 0 0 1-1.8 1.8H5.8a2.6 2.6 0 0 1-2.6-2.6z" />
      <path d="M3.2 8.4h18" />
      <circle cx="16.8" cy="13" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  spark: (
    <>
      <path d="M12 3.4 13.9 9l5.5 1.9-5.5 1.9L12 18.4l-1.9-5.6L4.6 10.9 10.1 9z" />
      <path d="M18.4 16.4l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />
    </>
  ),
  trash: (
    <>
      <path d="M4.2 6.8h15.6" />
      <path d="M9.4 6.8V4.6h5.2v2.2" />
      <path d="m6.4 6.8 1 13.2h9.2l1-13.2" />
      <path d="M10.2 10.8v5.6M13.8 10.8v5.6" />
    </>
  ),
  send: (
    <>
      <path d="M20.8 3.2 3.6 10.4l6.8 3.2 3.2 6.8z" />
      <path d="M20.8 3.2 10.4 13.6" />
    </>
  ),
  card: (
    <>
      <rect x="2.8" y="5" width="18.4" height="14" rx="2.6" />
      <path d="M2.8 9.8h18.4" />
      <path d="M6.6 14.6h4" />
    </>
  ),
  close: <path d="M18 6 6 18M6 6l12 12" />,
  arrow: (
    <>
      <path d="M4.6 12h14.8" />
      <path d="m13.6 6.2 5.8 5.8-5.8 5.8" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V11" />
      <path d="M10 20V4.6" />
      <path d="M16 20v-6.6" />
      <path d="M22 20H2" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.8" />
      <path d="M12 11.2v5" />
      <circle cx="12" cy="8.2" r=".7" fill="currentColor" stroke="none" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.8" />
      <path d="M12 7.4v5l3.2 2" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.2 4.8 6v5.6c0 4.4 3 7.8 7.2 9.2 4.2-1.4 7.2-4.8 7.2-9.2V6z" />
      <path d="m8.8 12 2.2 2.2 4.2-4.2" />
    </>
  ),
};

export function Icon({
  name,
  size = 18,
  style,
  className,
}: {
  name: IconName;
  size?: number;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      style={style}
    >
      {PATHS[name]}
    </svg>
  );
}
