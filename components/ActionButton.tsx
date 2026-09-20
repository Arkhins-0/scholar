"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const VARIANTS: Record<string, string> = {
  primary: "btn-primary",
  secondary: "btn-default",
  danger: "btn-danger",
  success: "btn-primary",
};

/** Small client button that POSTs to an API route and refreshes the page. */
export default function ActionButton({
  url,
  body,
  label,
  busyLabel,
  variant = "primary",
  confirmText,
  size,
}: {
  url: string;
  body?: unknown;
  label: string;
  busyLabel?: string;
  variant?: "primary" | "secondary" | "danger" | "success";
  confirmText?: string;
  size?: "sm";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setError(null);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Action failed");
      return;
    }
    router.refresh();
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className={`${VARIANTS[variant]} ${size === "sm" ? "btn-sm" : ""}`}
      >
        {busy ? busyLabel ?? "Working…" : label}
      </button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
