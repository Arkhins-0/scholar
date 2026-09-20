import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { jsonError, requireUuidParam } from "@/lib/api";
import { DOC_TYPE_LABELS, isEditableStatus } from "@/lib/milestones";
import { audit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { appUrl } from "@/lib/site";

/** Student submits (or resubmits after rejection) an application for review. */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole("STUDENT");
  if (auth.error) return auth.error;

  const bad = requireUuidParam(params.id);
  if (bad) return bad;

  const application = await prisma.milestoneApplication.findUnique({
    where: { id: params.id },
    include: {
      milestone: true,
      documents: { select: { docType: true } },
      student: {
        include: {
          user: { select: { name: true } },
          supervisor: { include: { user: { select: { email: true, name: true } } } },
        },
      },
    },
  });
  if (!application || application.student.userId !== auth.user.id) {
    return jsonError(404, "Application not found");
  }
  if (!isEditableStatus(application.status)) {
    return jsonError(409, "This application has already been submitted");
  }

  const uploadedTypes = new Set(application.documents.map((d) => d.docType));
  const missing = application.milestone.requiredDocs.filter((t) => !uploadedTypes.has(t));
  if (missing.length > 0) {
    return jsonError(400, `Missing required documents: ${missing.map((t) => DOC_TYPE_LABELS[t] ?? t).join(", ")}`);
  }

  const isResubmission = application.status !== "DRAFT";
  await prisma.milestoneApplication.update({
    where: { id: application.id },
    data: {
      status: "SUBMITTED",
      submittedAt: new Date(),
      // a fresh submission supersedes earlier review outcomes
      supervisorReviewedAt: null,
      rndReviewedAt: null,
    },
  });

  await audit({
    actorId: auth.user.id,
    action: isResubmission ? "APPLICATION_RESUBMITTED" : "APPLICATION_SUBMITTED",
    entityType: "MilestoneApplication",
    entityId: application.id,
    details: { milestone: application.milestone.code },
  });

  const supervisor = application.student.supervisor;
  if (supervisor) {
    await sendEmail({
      to: supervisor.user.email,
      subject: `${application.milestone.code} application ${isResubmission ? "resubmitted" : "submitted"}`,
      heading: `${application.student.user.name} ${isResubmission ? "resubmitted" : "submitted"} an application`,
      paragraphs: [
        `Hello ${supervisor.user.name},`,
        `${application.student.user.name} has ${isResubmission ? "resubmitted" : "submitted"} their ${application.milestone.name} application. Please review the documents and approve or return it with remarks.`,
      ],
      cta: { label: "Review the application", url: appUrl(`/staff/students/${application.studentId}`) },
    });
  }

  return NextResponse.json({ ok: true });
}
