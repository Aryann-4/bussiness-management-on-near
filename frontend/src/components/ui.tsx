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

export function StatCard({
  icon,
  label,
  value,
  hint,
  tone = "indigo",
}: {
  icon: IconName;
  label: string;
  value: string;
  hint: string;
  tone?: "indigo" | "mint" | "amber" | "sky";
}) {
  return (
    <div className="stat">
      <div className={`stat-icon tone-${tone}`}>
        <Icon name={icon} size={19} />
      </div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
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
    </div>
  );
}
