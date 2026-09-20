import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, Lock, XCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/authz";
import { canOpenMilestone } from "@/lib/gating";
import { DOC_TYPE_LABELS, isEditableStatus, isMilestoneCode } from "@/lib/milestones";
import StatusBadge from "@/components/StatusBadge";
import DocumentUpload from "@/components/DocumentUpload";
import ActionButton from "@/components/ActionButton";
import ApplicationTracker from "@/components/ApplicationTracker";
import EmptyState from "@/components/EmptyState";

export const dynamic = "force-dynamic";

export default async function MilestonePage({ params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();
  if (!isMilestoneCode(code)) notFound();

  const user = await getSessionUser();
  if (!user) redirect("/login");

  const profile = await prisma.studentProfile.findUnique({ where: { userId: user.id } });
  if (!profile) redirect("/login");

  const milestone = await prisma.milestone.findUnique({ where: { code } });
  if (!milestone) notFound();

  const gate = await canOpenMilestone(profile.id, code);

  if (!gate.allowed) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="box">
          <EmptyState
            icon={Lock}
            title={`${milestone.name} is locked`}
            description={gate.reason}
            action={
              <Link href="/student/dashboard" className="btn-default">
                <ArrowLeft size={15} /> Back to overview
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  // The stage is unlocked: open the draft application automatically so the
  // upload slots are immediately visible.
  let application = await prisma.milestoneApplication.findUnique({
    where: { studentId_milestoneId: { studentId: profile.id, milestoneId: milestone.id } },
    include: { documents: { orderBy: { uploadedAt: "asc" } } },
  });
  if (!application) {
    application = await prisma.milestoneApplication.create({
      data: { studentId: profile.id, milestoneId: milestone.id, status: "DRAFT" },
      include: { documents: true },
    });
  }

  const editable = isEditableStatus(application.status);
  const uploadedTypes = new Set(application.documents.map((d) => d.docType));
  const missing = milestone.requiredDocs.filter((t) => !uploadedTypes.has(t));
  const wasRejected = application.status === "SUPERVISOR_REJECTED" || application.status === "RND_REJECTED";

  return (
    <div>
      <Link href="/student/dashboard" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft size={14} /> Overview
      </Link>

      <div className="pagehead">
        <div>
          <div className="mono text-xs uppercase text-faint">{milestone.code}</div>
          <h1 className="display text-2xl leading-tight">{milestone.name}</h1>
          <p className="mt-1 text-sm text-muted">Upload every required document, then submit for review.</p>
        </div>
        <StatusBadge status={application.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          {wasRejected && (
            <div className="flash-error items-start p-4">
              <XCircle size={18} className="mt-0.5 shrink-0 text-danger" />
              <div className="min-w-0">
                <div className="text-sm font-semibold">
                  Returned by {application.status === "SUPERVISOR_REJECTED" ? "your supervisor" : "the R&D section"}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm">
                  {application.status === "SUPERVISOR_REJECTED" ? application.supervisorRemarks : application.rndRemarks}
                </p>
                <p className="mt-2 text-xs text-muted">Update your documents below and resubmit.</p>
              </div>
            </div>
          )}

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="section-title">Required documents</h2>
              <span className="text-xs text-muted">
                {milestone.requiredDocs.length - missing.length} of {milestone.requiredDocs.length} provided
              </span>
            </div>
            {milestone.requiredDocs.map((docType) => (
              <DocumentUpload
                key={docType}
                applicationId={application.id}
                docType={docType}
                label={DOC_TYPE_LABELS[docType] ?? docType}
                editable={editable}
                docs={application.documents
                  .filter((d) => d.docType === docType)
                  .map((d) => ({ id: d.id, fileName: d.fileName, size: d.size, uploadedAt: d.uploadedAt.toISOString() }))}
              />
            ))}
          </section>

          {editable && (
            <div className="box-footer box flex flex-wrap items-center justify-between gap-4">
              <div className="text-sm">
                {missing.length > 0 ? (
                  <span className="inline-flex items-center gap-2 text-attention">
                    <AlertTriangle size={16} />
                    Still missing: {missing.map((t) => DOC_TYPE_LABELS[t] ?? t).join(", ")}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 text-success">
                    <CheckCircle2 size={16} />
                    All required documents uploaded. Ready to submit.
                  </span>
                )}
              </div>
              <ActionButton
                url={`/api/applications/${application.id}/submit`}
                label={wasRejected ? "Resubmit application" : "Submit application"}
                busyLabel="Submitting…"
                confirmText="Submit this application for supervisor review? Documents are locked while under review."
              />
            </div>
          )}
        </div>

        <aside>
          <div className="box">
            <div className="box-header">
              <h2 className="box-title">Application tracking</h2>
            </div>
            <div className="box-body">
              <ApplicationTracker app={application} isDegree={code === "DEGREE"} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
