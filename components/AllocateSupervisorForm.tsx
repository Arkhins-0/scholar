"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserCheck } from "lucide-react";

export default function AllocateSupervisorForm({
  studentId,
  staffPool,
}: {
  studentId: string;
  staffPool: { id: string; name: string; detail: string }[];
}) {
  const router = useRouter();
  const [staffId, setStaffId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function allocate(e: React.FormEvent) {
    e.preventDefault();
    if (!staffId) {
      setError("Pick a staff member");
      return;
    }
    setError(null);
    setBusy(true);
    const res = await fetch("/api/admin/supervisor-requests/allocate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, staffId }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Allocation failed");
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={allocate} className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor={`sup-${studentId}`}>
        Supervisor
      </label>
      <select
        id={`sup-${studentId}`}
        className="input max-w-sm"
        value={staffId}
        onChange={(e) => setStaffId(e.target.value)}
      >
        <option value="">Select a supervisor</option>
        {staffPool.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} {s.detail ? `(${s.detail})` : ""}
          </option>
        ))}
      </select>
      <button type="submit" disabled={busy} className="btn-primary">
        <UserCheck size={15} />
        {busy ? "Allocating…" : "Allocate supervisor"}
      </button>
      {error && <p className="w-full text-xs text-danger">{error}</p>}
    </form>
  );
}
