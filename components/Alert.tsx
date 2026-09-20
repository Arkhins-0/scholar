"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle, type LucideIcon } from "lucide-react";

export type AlertTone = "info" | "success" | "warn" | "error";

const TONES: Record<AlertTone, { icon: LucideIcon; card: string; badge: string }> = {
  info: {
    icon: Info,
    card: "border-accent/25 bg-accent/[0.07] dark:bg-accent/[0.12]",
    badge: "bg-accent/15 text-accent",
  },
  success: {
    icon: CheckCircle2,
    card: "border-success/25 bg-success/[0.07] dark:bg-success/[0.12]",
    badge: "bg-success/15 text-success",
  },
  warn: {
    icon: AlertTriangle,
    card: "border-attention/30 bg-attention/[0.08] dark:bg-attention/[0.12]",
    badge: "bg-attention/15 text-attention",
  },
  error: {
    icon: XCircle,
    card: "border-danger/25 bg-danger/[0.07] dark:bg-danger/[0.12]",
    badge: "bg-danger/15 text-danger",
  },
};

/**
 * Contextual alert: soft tinted card, circular icon badge, bold title, body,
 * optional dismiss. Works in both themes.
 */
export default function Alert({
  tone,
  title,
  children,
  dismissible = false,
  className = "",
  actions,
}: {
  tone: AlertTone;
  title?: string;
  children?: React.ReactNode;
  dismissible?: boolean;
  className?: string;
  actions?: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  const t = TONES[tone];
  const Icon = t.icon;

  return (
    <div role={tone === "error" ? "alert" : "status"} className={`flex gap-3 rounded-xl border p-4 ${t.card} ${className}`}>
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${t.badge}`}>
        <Icon size={18} strokeWidth={2.2} />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        {title && <div className="text-sm font-semibold leading-5 text-fg">{title}</div>}
        {children && <div className={`text-sm leading-relaxed text-muted ${title ? "mt-0.5" : ""}`}>{children}</div>}
        {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
      </div>
      {dismissible && (
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Dismiss"
          className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-fg/5 hover:text-fg"
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
}
