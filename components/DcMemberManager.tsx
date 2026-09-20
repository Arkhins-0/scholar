"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Mail, Pencil, Power, Trash2, UserPlus, Users, X } from "lucide-react";
import EmptyState from "@/components/EmptyState";

export type DcMemberRow = {
  id: string;
  name: string;
  email: string;
  department: string;
  designation: string;
  affiliation: string;
  isActive: boolean;
  assignments: number;
};

const empty = { name: "", email: "", department: "", designation: "", affiliation: "" };

function EditRow({ member, onDone }: { member: DcMemberRow; onDone: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: member.name,
    email: member.email,
    department: member.department,
    designation: member.designation,
    affiliation: member.affiliation,
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/dc-members/${member.id}`, {
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
    <form onSubmit={save} className="grid gap-3 border border-line bg-elevated p-4 sm:grid-cols-2">
      {error && <p className="flash-error sm:col-span-2">{error}</p>}
      <div>
        <label className="label">Name</label>
        <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div>
        <label className="label">Email</label>
        <input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </div>
      <div>
        <label className="label">Designation</label>
        <input className="input" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
      </div>
      <div>
        <label className="label">Department</label>
        <input className="input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
      </div>
      <div className="sm:col-span-2">
        <label className="label">Affiliation / institution</label>
        <input className="input" value={form.affiliation} onChange={(e) => setForm({ ...form, affiliation: e.target.value })} />
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

export default function DcMemberManager({ members }: { members: DcMemberRow[] }) {
  const router = useRouter();
  const [form, setForm] = useState(empty);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy("create");
    const res = await fetch("/api/admin/dc-members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setBusy(null);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Could not add the DC member");
      return;
    }
    setForm(empty);
    router.refresh();
  }

  async function toggleActive(m: DcMemberRow) {
    setBusy(m.id);
    await fetch(`/api/admin/dc-members/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !m.isActive }),
    });
    setBusy(null);
    router.refresh();
  }

  async function remove(m: DcMemberRow) {
    const msg =
      m.assignments > 0
        ? `${m.name} is on ${m.assignments} committee(s). They will be deactivated (kept for history) rather than deleted. Continue?`
        : `Delete ${m.name} from the DC member pool?`;
    if (!window.confirm(msg)) return;
    setBusy(m.id);
    await fetch(`/api/admin/dc-members/${m.id}`, { method: "DELETE" });
    setBusy(null);
    router.refresh();
  }

  const active = members.filter((m) => m.isActive).length;

  return (
    <div className="space-y-6">
      <form onSubmit={create} className="box">
        <div className="box-header">
          <h2 className="box-title flex items-center gap-2">
            <UserPlus size={15} className="text-muted" /> Add a DC member
          </h2>
          <span className="text-xs text-muted">Examiners and experts that supervisors assign to committees.</span>
        </div>
        <div className="box-body space-y-4">
          {error && <p className="flash-error">{error}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Full name</label>
              <input required className="input" placeholder="Dr. Jane Doe" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Email <span className="font-normal text-muted">(optional)</span></label>
              <input type="email" className="input" placeholder="jane@university.edu" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="label">Designation <span className="font-normal text-muted">(optional)</span></label>
              <input className="input" placeholder="Professor" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
            </div>
            <div>
              <label className="label">Department <span className="font-normal text-muted">(optional)</span></label>
              <input className="input" placeholder="Computer Science" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Affiliation / institution <span className="font-normal text-muted">(optional)</span></label>
              <input className="input" placeholder="IIT Madras" value={form.affiliation} onChange={(e) => setForm({ ...form, affiliation: e.target.value })} />
            </div>
          </div>
        </div>
        <div className="box-footer flex justify-end">
          <button type="submit" disabled={busy === "create"} className="btn-primary">
            {busy === "create" ? "Adding…" : "Add member"}
          </button>
        </div>
      </form>

      <div className="box">
        <div className="box-header">
          <h2 className="box-title">DC member pool</h2>
          <span className="chip">
            <Users size={12} /> {active} active · {members.length} total
          </span>
        </div>
        {members.length === 0 ? (
          <EmptyState icon={Users} title="No DC members yet" description="Add the first examiner above." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="th">Member</th>
                  <th className="th">Affiliation</th>
                  <th className="th">Email</th>
                  <th className="th">Committees</th>
                  <th className="th">Status</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {members.map((m) => (
                  <Fragment key={m.id}>
                    <tr className={m.isActive ? "" : "opacity-60"}>
                      <td className="td">
                        <div className="font-medium">{m.name}</div>
                        {m.designation && <div className="text-xs text-muted">{m.designation}</div>}
                      </td>
                      <td className="td">
                        {m.affiliation || m.department ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Building2 size={14} className="text-faint" />
                            {[m.affiliation, m.department].filter(Boolean).join(" · ")}
                          </span>
                        ) : (
                          <span className="text-faint">—</span>
                        )}
                      </td>
                      <td className="td">
                        {m.email ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Mail size={14} className="text-faint" />
                            {m.email}
                          </span>
                        ) : (
                          <span className="text-faint">—</span>
                        )}
                      </td>
                      <td className="td tabular-nums">{m.assignments}</td>
                      <td className="td">
                        {m.isActive ? (
                          <span className="chip border-success/40 text-success">Active</span>
                        ) : (
                          <span className="chip">Inactive</span>
                        )}
                      </td>
                      <td className="td">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            title={m.isActive ? "Deactivate" : "Activate"}
                            disabled={busy === m.id}
                            onClick={() => toggleActive(m)}
                            className="btn-invisible btn-sm btn-icon"
                          >
                            <Power size={14} className={m.isActive ? "text-success" : "text-faint"} />
                          </button>
                          <button
                            type="button"
                            title="Edit"
                            onClick={() => setEditingId(editingId === m.id ? null : m.id)}
                            className="btn-invisible btn-sm btn-icon"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            title="Remove"
                            disabled={busy === m.id}
                            onClick={() => remove(m)}
                            className="btn-invisible btn-sm btn-icon text-danger hover:text-danger"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {editingId === m.id && (
                      <tr>
                        <td colSpan={6} className="px-4 pb-4">
                          <EditRow member={m} onDone={() => setEditingId(null)} />
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
