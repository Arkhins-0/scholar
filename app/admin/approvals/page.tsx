import { CheckCircle2, ClipboardCheck, Paperclip } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { DOC_TYPE_LABELS } from "@/lib/milestones";
import { fmtDateTime } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import ReviewForm from "@/components/ReviewForm";
import EmptyState from "@/components/EmptyState";

export const dynamic = "force-dynamic";

export default async function AdminApprovalsPage() {
  const applications = await prisma.milestoneApplication.findMany({
    where: { status: "SUPERVISOR_APPROVED" },
    include: {
      milestone: true,
      documents: { orderBy: { uploadedAt: "asc" } },
      student: {
        include: {
          user: { select: { name: true, email: true } },
          supervisor: { include: { user: { select: { name: true } } } },
        },
      },
    },
    orderBy: { supervisorReviewedAt: "asc" },
  });

  return (
    <div>
      <PageHeader
        icon={ClipboardCheck}
        title="R&D approvals"
        subtitle="Applications approved by supervisors, awaiting the final decision. Oldest first."
        actions={<span className="counter h-7 px-2 text-sm">{applications.length} waiting</span>}
      />

      {applications.length === 0 ? (
        <div className="box">
          <EmptyState icon={CheckCircle2} title="Nothing waiting for R&D review" description="Supervisor-approved applications appear here." />
        </div>
      ) : (
        <div className="space-y-6">
          {applications.map((app) => (
            <div key={app.id} className="box">
              <div className="box-header">
                <div>
                  <h2 className="box-title">
                    {app.student.user.name}
                    <span className="mx-2 text-faint">/</span>
                    <span className="mono mr-1.5 text-xs uppercase text-faint">{app.milestone.code}</span>
                    {app.milestone.name}
                  </h2>
                  <p className="text-xs text-muted">
                    Approved by {app.student.supervisor?.user.name ?? "—"} on {fmtDateTime(app.supervisorReviewedAt)} · {app.student.user.email}
                  </p>
                </div>
              </div>

              {app.supervisorRemarks && (
                <div className="box-row text-sm">
                  <span className="font-semibold">Supervisor remarks: </span>
                  <span className="whitespace-pre-wrap">{app.supervisorRemarks}</span>
                </div>
              )}

              <div className="box-row">
                <h3 className="section-title mb-2">Documents</h3>
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {app.documents.map((d) => (
                    <li key={d.id}>
                      <a
                        href={`/api/documents/${d.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 border border-line bg-elevated px-3 py-2 text-sm transition-colors hover:border-accent"
                      >
                        <Paperclip size={14} className="shrink-0 text-faint" />
                        <span className="min-w-0 truncate">
                          <span className="font-medium">{DOC_TYPE_LABELS[d.docType] ?? d.docType}</span>
                          <span className="text-muted"> · {d.fileName}</span>
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="box-row">
                <ReviewForm url={`/api/applications/${app.id}/rnd-review`} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
