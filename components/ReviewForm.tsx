"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ThumbsUp, XCircle } from "lucide-react";

/** Approve/reject form used by both Supervisor and R&D reviews. */
export default function ReviewForm({ url }: { url: string }) {
  const router = useRouter();
  const [decision, setDecision] = useState<"APPROVE" | "REJECT">("APPROVE");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (decision === "REJECT" && remarks.trim().length === 0) {
      setError("Remarks are required when rejecting");
      return;
    }
    setBusy(true);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, remarks: remarks.trim() }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Review failed");
      return;
    }
    setRemarks("");
    router.refresh();
  }

  const segment = (value: "APPROVE" | "REJECT", Icon: typeof ThumbsUp, text: string, tone: string) => (
    <button
      type="button"
      onClick={() => setDecision(value)}
      aria-pressed={decision === value}
      className={`inline-flex h-8 items-center gap-2 border px-3 text-sm font-medium transition-colors ${
        decision === value ? tone : "border-line bg-surface text-muted hover:text-fg"
      }`}
    >
      <Icon size={15} /> {text}
    </button>
  );

  return (
    <form onSubmit={onSubmit} className="space-y-3 border border-line bg-elevated p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold">Decision</span>
        <div className="flex -space-x-px">
          {segment("APPROVE", ThumbsUp, "Approve", "border-success bg-success/10 text-success z-10")}
          {segment("REJECT", XCircle, "Return with remarks", "border-danger bg-danger/10 text-danger z-10")}
        </div>
      </div>
      <textarea
        className="input min-h-[88px]"
        placeholder={decision === "REJECT" ? "Remarks (required when returning)" : "Remarks (optional)"}
        value={remarks}
        onChange={(e) => setRemarks(e.target.value)}
        maxLength={5000}
      />
      {error && (
        <p className="flash-error">
          <AlertCircle size={15} className="mt-0.5 shrink-0 text-danger" />
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <button type="submit" disabled={busy} className={decision === "APPROVE" ? "btn-primary" : "btn-danger"}>
          {busy ? "Submitting…" : decision === "APPROVE" ? "Approve application" : "Return to scholar"}
        </button>
      </div>
    </form>
  );
}
