import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { jsonError, parseBody, requireUuidParam } from "@/lib/api";
import { reviewSchema } from "@/lib/schemas";
import { audit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { appUrl } from "@/lib/site";

/** Supervisor approves/rejects a SUBMITTED application. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole("STAFF");
  if (auth.error) return auth.error;

  const bad = requireUuidParam(params.id);
  if (bad) return bad;

  const body = await parseBody(req, reviewSchema);
  if (body.error) return body.error;

  const staff = await prisma.staffProfile.findUnique({ where: { userId: auth.user.id } });
  if (!staff) return jsonError(403, "No staff profile");

  const application = await prisma.milestoneApplication.findUnique({
    where: { id: params.id },
    include: {
      milestone: true,
      student: { include: { user: { select: { email: true, name: true } } } },
    },
  });
  if (!application || application.student.supervisorId !== staff.id) {
    return jsonError(404, "Application not found");
  }
  if (application.status !== "SUBMITTED") {
    return jsonError(409, "Only submitted applications can be reviewed by the supervisor");
  }

  const approved = body.data.decision === "APPROVE";
  await prisma.milestoneApplication.update({
    where: { id: application.id },
    data: {
      status: approved ? "SUPERVISOR_APPROVED" : "SUPERVISOR_REJECTED",
      supervisorReviewedAt: new Date(),
      supervisorRemarks: body.data.remarks || null,
    },
  });

  await audit({
    actorId: auth.user.id,
    action: approved ? "SUPERVISOR_APPROVED" : "SUPERVISOR_REJECTED",
    entityType: "MilestoneApplication",
    entityId: application.id,
    details: { milestone: application.milestone.code, remarks: body.data.remarks || null },
  });

  await sendEmail({
    to: application.student.user.email,
    subject: `${application.milestone.code} application ${approved ? "approved by supervisor" : "returned by supervisor"}`,
    heading: approved ? "Approved by your supervisor" : "Returned by your supervisor",
    paragraphs: approved
      ? [
          `Hello ${application.student.user.name},`,
          `Your ${application.milestone.name} application was approved by your supervisor and forwarded to the R&D section for the final decision.`,
          ...(body.data.remarks ? [`Supervisor remarks:\n${body.data.remarks}`] : []),
        ]
      : [
          `Hello ${application.student.user.name},`,
          `Your ${application.milestone.name} application was returned by your supervisor with the remarks below. Please revise your documents and resubmit.`,
          `Remarks:\n${body.data.remarks}`,
        ],
    cta: { label: "View the application", url: appUrl(`/student/milestones/${application.milestone.code}`) },
  });

  if (approved) {
    const admins = await prisma.user.findMany({ where: { role: "RND_ADMIN" }, select: { email: true } });
    await Promise.all(
      admins.map((a) =>
        sendEmail({
          to: a.email,
          subject: `${application.milestone.code} application awaiting R&D review`,
          heading: "An application awaits your review",
          paragraphs: [
            `The ${application.milestone.name} application of ${application.student.user.name} was approved by the supervisor and is now in the R&D approvals queue.`,
          ],
          cta: { label: "Open R&D approvals", url: appUrl("/admin/approvals") },
        })
      )
    );
  }

  return NextResponse.json({ ok: true });
}
