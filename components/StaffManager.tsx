"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Pencil, UserPlus, Users, X } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import Alert from "@/components/Alert";

export type StaffRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  supervising: number;
  coSupervising: number;
};

function StaffEditRow({ staff, onDone }: { staff: StaffRow; onDone: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: staff.name,
    phone: staff.phone,
    department: staff.department,
    designation: staff.designation,
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/staff/${staff.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Update failed");
      return;
    }
    onDone();
    router.refresh();
  }

  return (
    <form onSubmit={save} className="grid gap-3 rounded-lg border border-line bg-elevated p-4 sm:grid-cols-2">
      {error && (
        <Alert tone="error" title="Update failed" className="sm:col-span-2">
          {error}
        </Alert>
      )}
      <div>
        <label className="label">Name</label>
        <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div>
        <label className="label">Phone</label>
        <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      </div>
      <div>
        <label className="label">Department</label>
        <input className="input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
      </div>
      <div>
        <label className="label">Designation</label>
        <input className="input" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
      </div>
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" disabled={busy} className="btn-primary">
          {busy ? "Saving…" : "Save changes"}
        </button>
        <button type="button" onClick={onDone} className="btn-default">
          <X size={15} /> Cancel
        </button>
      </div>
    </form>
  );
}

export default function StaffManager({ staff }: { staff: StaffRow[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", phone: "", department: "", designation: "" });
  const [createdPassword, setCreatedPassword] = useState<{ email: string; password: string } | null>(null);
  const [resetPassword, setResetPassword] = useState<{ id: string; password: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function createStaff(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy("create");
    const res = await fetch("/api/admin/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setBusy(null);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Could not create the staff account");
      return;
    }
    const data = await res.json();
    setCreatedPassword({ email: form.email, password: data.tempPassword });
    setForm({ name: "", email: "", phone: "", department: "", designation: "" });
    router.refresh();
  }

  async function reset(id: string) {
    if (!window.confirm("Reset this staff member's password? Their current password stops working immediately.")) return;
    setError(null);
    setBusy(id);
    const res = await fetch(`/api/admin/staff/${id}/reset-password`, { method: "POST" });
    setBusy(null);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Reset failed");
      return;
    }
    const data = await res.json();
    setResetPassword({ id, password: data.tempPassword });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={createStaff} className="box">
        <div className="box-header">
          <h2 className="box-title flex items-center gap-2">
            <UserPlus size={15} className="text-muted" /> Add a staff member
          </h2>
          <span className="text-xs text-muted">A temporary password is emailed and shown once.</span>
        </div>
        <div className="box-body space-y-4">
          {error && (
            <Alert tone="error" title="Could not create the account" dismissible>
              {error}
            </Alert>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Full name</label>
              <input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Email</label>
              <input required type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="label">Phone <span className="font-normal text-muted">(optional)</span></label>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="label">Department <span className="font-normal text-muted">(optional)</span></label>
              <input className="input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
            </div>
            <div>
              <label className="label">Designation <span className="font-normal text-muted">(optional)</span></label>
              <input className="input" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
            </div>
          </div>
          {createdPassword && (
            <Alert tone="warn" title={`Temporary password for ${createdPassword.email}`} dismissible>
              <p>Shown only once. It has also been emailed; they must change it on first login.</p>
              <p className="mono mt-2 inline-block rounded-md border border-line bg-surface px-2 py-1 text-base text-fg">
                {createdPassword.password}
              </p>
            </Alert>
          )}
        </div>
        <div className="box-footer flex justify-end">
          <button type="submit" disabled={busy === "create"} className="btn-primary">
            {busy === "create" ? "Creating…" : "Create staff account"}
          </button>
        </div>
      </form>

      <div className="box">
        <div className="box-header">
          <h2 className="box-title">Staff pool</h2>
          <span className="chip">
            <Users size={12} /> {staff.length} total
          </span>
        </div>
        {staff.length === 0 ? (
          <EmptyState icon={Users} title="No staff yet" description="Add the first supervisor above." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="th">Name</th>
                  <th className="th">Email</th>
                  <th className="th">Department</th>
                  <th className="th">Roles</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {staff.map((s) => (
                  <Fragment key={s.id}>
                    <tr>
                      <td className="td">
                        <div className="font-medium">{s.name}</div>
                        {s.designation && <div className="text-xs text-muted">{s.designation}</div>}
                      </td>
                      <td className="td">{s.email}</td>
                      <td className="td">{s.department || <span className="text-faint">—</span>}</td>
                      <td className="td">
                        <div className="flex flex-wrap gap-1">
                          <span className="chip">{s.supervising} supervising</span>
                          <span className="chip">{s.coSupervising} co-supervising</span>
                        </div>
                      </td>
                      <td className="td">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            title={editingId === s.id ? "Close" : "Edit"}
                            className="btn-invisible btn-sm btn-icon"
                            onClick={() => setEditingId(editingId === s.id ? null : s.id)}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            title="Reset password"
                            disabled={busy === s.id}
                            className="btn-invisible btn-sm btn-icon text-attention hover:text-attention"
                            onClick={() => reset(s.id)}
                          >
                            <KeyRound size={14} />
                          </button>
                        </div>
                        {resetPassword?.id === s.id && (
                          <p className="mt-1 rounded-md border border-attention/30 bg-attention/[0.08] px-2 py-1 text-right text-xs">
                            New temporary password: <span className="mono text-fg">{resetPassword.password}</span>
                          </p>
                        )}
                      </td>
                    </tr>
                    {editingId === s.id && (
                      <tr>
                        <td colSpan={5} className="px-4 pb-4">
                          <StaffEditRow staff={s} onDone={() => setEditingId(null)} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
