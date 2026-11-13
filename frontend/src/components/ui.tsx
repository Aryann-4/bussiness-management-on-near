import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Toast } from "../appTypes";
import type { InvoiceStatus } from "../types";
import { Icon, type IconName } from "./Icon";

export function StatusBadge({ status }: { status: InvoiceStatus }) {
  const tone = {
    Draft: "draft",
    Sent: "sent",
    Paid: "paid",
    Cancelled: "cancelled",
  }[status];
  return (
    <span className={`badge ${tone}`}>
      <span className="badge-dot" />
      {status}
    </span>
  );
}

function useCountUp(target: number, duration = 800): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(target * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
}

export function StatCard({
  icon,
  label,
  value,
  hint,
  format = (n: number) => String(Math.round(n)),
  tone = "indigo",
}: {
  icon: IconName;
  label: string;
  value: number;
  hint: string;
  format?: (value: number) => string;
  tone?: "indigo" | "mint" | "amber" | "sky";
}) {
  const display = format(useCountUp(value));
  return (
    <div className="stat">
      <div className={`stat-icon tone-${tone}`}>
        <Icon name={icon} size={19} />
      </div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{display}</div>
      <div className="stat-hint">{hint}</div>
    </div>
  );
}

export function EmptyState({
  icon = "spark",
  title,
  hint,
  action,
}: {
  icon?: IconName;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon name={icon} size={20} />
      </div>
      <div className="empty-title">{title}</div>
      {hint && <p className="empty-hint">{hint}</p>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="overlay" onClick={onClose} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p className="modal-sub">{subtitle}</p>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-actions">{footer}</div>}
      </div>
    </div>
  );
}

export function ToastView({ toast }: { toast: Toast }) {
  if (!toast) return null;
  return (
    <div className={`toast ${toast.kind}`} role="status">
      <span className="toast-icon">
        <Icon name={toast.kind === "success" ? "check" : "info"} size={16} />
      </span>
      <span>{toast.message}</span>
      <span className="toast-progress" aria-hidden="true" />
    </div>
  );
}
