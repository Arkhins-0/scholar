"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, UserCog, UsersRound } from "lucide-react";
import Alert from "@/components/Alert";

type Option = { id: string; name: string; detail: string };

export default function CommitteeForm({
  studentId,
  dcPool,
  currentDcIds,
  staffPool,
  currentCoSupervisorId,
}: {
  studentId: string;
  dcPool: Option[];
  currentDcIds: string[];
  staffPool: Option[];
  currentCoSupervisorId: string | null;
}) {
  const router = useRouter();
  const [dcIds, setDcIds] = useState<string[]>(currentDcIds);
  const [coSupervisorId, setCoSupervisorId] = useState<string>(currentCoSupervisorId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<"dc" | "cosup" | null>(null);

  function toggle(id: string) {
    setDcIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  async function saveDc() {
    setError(null);
    setNotice(null);
    if (dcIds.length < 2 || dcIds.length > 5) {
      setError("Select between 2 and 5 DC members.");
      return;
    }
    setBusy("dc");
    const res = await fetch(`/api/staff/students/${studentId}/committee`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dcMemberIds: dcIds }),
    });
    setBusy(null);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Could not save the committee.");
      return;
    }
    setNotice("Doctoral Committee saved.");
    router.refresh();
  }

  async function saveCoSup() {
    setError(null);
    setNotice(null);
    setBusy("cosup");
    const res = await fetch(`/api/staff/students/${studentId}/co-supervisor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coSupervisorId: coSupervisorId || null }),
    });
    setBusy(null);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Could not save the co-supervisor.");
      return;
    }
    setNotice("Co-supervisor saved.");
    router.refresh();
  }

  const withinRange = dcIds.length >= 2 && dcIds.length <= 5;

  return (
    <div className="space-y-5">
      {error && (
        <Alert tone="error" title="Could not save" dismissible>
          {error}
        </Alert>
      )}
      {notice && (
        <Alert tone="success" title="Saved" dismissible>
          {notice}
        </Alert>
      )}

      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <UsersRound size={15} className="text-muted" />
            <h3 className="text-sm font-semibold">Doctoral Committee members</h3>
          </div>
          <span className={`chip ${withinRange ? "border-success/40 text-success" : ""}`}>
            {dcIds.length} selected · need 2 to 5
          </span>
        </div>

        {dcPool.length === 0 ? (
          <Alert tone="info" title="No DC members in the pool yet">
            Ask the R&amp;D section to add examiners on the DC members page; they will appear here.
          </Alert>
        ) : (
          <div className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">
            {dcPool.map((m) => {
              const checked = dcIds.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggle(m.id)}
                  aria-pressed={checked}
                  className={`flex items-center gap-3 p-3 text-left transition-colors ${
                    checked ? "bg-accent/10" : "bg-surface hover:bg-elevated"
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border ${
                      checked ? "border-accent bg-accent text-white" : "border-faint bg-bg"
                    }`}
                  >
                    {checked && <Check size={12} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{m.name}</span>
                    {m.detail && (
                      <span className="flex items-center gap-1 truncate text-xs text-muted">
                        <Building2 size={11} />
                        {m.detail}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <button type="button" onClick={saveDc} disabled={busy !== null || dcPool.length === 0} className="btn-primary mt-3">
          {busy === "dc" ? "Saving…" : "Save committee"}
        </button>
      </div>

      <div className="border-t border-line pt-5">
        <div className="mb-3 flex items-center gap-2">
          <UserCog size={15} className="text-muted" />
          <h3 className="text-sm font-semibold">Co-supervisor</h3>
          <span className="text-xs text-muted">optional, from the staff pool</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className="input max-w-xs" value={coSupervisorId} onChange={(e) => setCoSupervisorId(e.target.value)}>
            <option value="">None</option>
            {staffPool.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} {s.detail ? `(${s.detail})` : ""}
              </option>
            ))}
          </select>
          <button type="button" onClick={saveCoSup} disabled={busy !== null} className="btn-default">
            {busy === "cosup" ? "Saving…" : "Save co-supervisor"}
          </button>
        </div>
      </div>
    </div>
  );
}
