import { CheckCircle2, Inbox, Paperclip } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { fmtDate } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import AllocateSupervisorForm from "@/components/AllocateSupervisorForm";
import EmptyState from "@/components/EmptyState";
import StatusBadge from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function SupervisorRequestsPage() {
  const [requests, staffPool] = await Promise.all([
    prisma.studentProfile.findMany({
      where: { supervisorRequestStatus: "PENDING" },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.staffProfile.findMany({
      include: { user: { select: { name: true } }, _count: { select: { supervisingStudents: true } } },
      orderBy: { user: { name: "asc" } },
    }),
  ]);

  const pool = staffPool.map((s) => ({
    id: s.id,
    name: s.user.name,
    detail: [s.designation, s.department, `${s._count.supervisingStudents} scholars`].filter(Boolean).join(" · "),
  }));

  return (
    <div>
      <PageHeader
        icon={Inbox}
        title="Supervisor requests"
        subtitle="Scholars whose proposal is complete and who are waiting for a supervisor. Oldest first."
        actions={<span className="counter h-7 px-2 text-sm">{requests.length} pending</span>}
      />

      {requests.length === 0 ? (
        <div className="box">
          <EmptyState icon={CheckCircle2} title="The queue is empty" description="New requests appear here when a scholar completes their proposal." />
        </div>
      ) : (
        <div className="space-y-6">
          {requests.map((r) => (
            <div key={r.id} className="box">
              <div className="box-header">
                <div>
                  <h2 className="box-title">{r.user.name}</h2>
                  <p className="text-xs text-muted">
                    {r.user.email}
                    {r.registrationNo ? ` · ${r.registrationNo}` : ""} · Registered {fmtDate(r.createdAt)}
                  </p>
                </div>
                <StatusBadge status="PENDING" label="Pending" />
              </div>
              <dl className="grid gap-px bg-line sm:grid-cols-2">
                <div className="bg-surface px-4 py-3 sm:col-span-2">
                  <dt className="text-xs text-muted">Title</dt>
                  <dd className="display mt-0.5 text-base leading-snug">{r.title}</dd>
                </div>
                <div className="bg-surface px-4 py-3">
                  <dt className="text-xs text-muted">Domain</dt>
                  <dd className="font-medium">{r.domain}</dd>
                </div>
                <div className="bg-surface px-4 py-3">
                  <dt className="text-xs text-muted">Proposed work</dt>
                  <dd>
                    {r.proposalStorageKey ? (
                      <a
                        href={`/api/students/${r.id}/proposal-document`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 font-medium text-accent hover:underline"
                      >
                        <Paperclip size={14} />
                        {r.proposalFileName ?? "Proposal document"}
                      </a>
                    ) : (
                      <span className="text-faint">Not uploaded</span>
                    )}
                  </dd>
                </div>
              </dl>
              <div className="box-footer">
                <AllocateSupervisorForm studentId={r.id} staffPool={pool} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
