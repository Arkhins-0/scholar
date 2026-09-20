import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { jsonError, parseBody, requireUuidParam } from "@/lib/api";
import { reviewSchema } from "@/lib/schemas";
import { audit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { appUrl } from "@/lib/site";

/** R&D approves/rejects an application the supervisor already approved. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole("RND_ADMIN");
  if (auth.error) return auth.error;

  const bad = requireUuidParam(params.id);
  if (bad) return bad;

  const body = await parseBody(req, reviewSchema);
  if (body.error) return body.error;

  const application = await prisma.milestoneApplication.findUnique({
    where: { id: params.id },
    include: {
      milestone: true,
      student: {
        include: {
          user: { select: { email: true, name: true } },
          supervisor: { include: { user: { select: { email: true } } } },
        },
      },
    },
  });
  if (!application) return jsonError(404, "Application not found");
  if (application.status !== "SUPERVISOR_APPROVED") {
    return jsonError(409, "Only supervisor-approved applications can be reviewed by R&D");
  }

  const approved = body.data.decision === "APPROVE";
  await prisma.milestoneApplication.update({
    where: { id: application.id },
    data: {
      status: approved ? "RND_APPROVED" : "RND_REJECTED",
      rndReviewedAt: new Date(),
      rndRemarks: body.data.remarks || null,
    },
  });

  await audit({
    actorId: auth.user.id,
    action: approved ? "RND_APPROVED" : "RND_REJECTED",
    entityType: "MilestoneApplication",
    entityId: application.id,
    details: { milestone: application.milestone.code, remarks: body.data.remarks || null },
  });

  await sendEmail({
    to: application.student.user.email,
    subject: `${application.milestone.code} application ${approved ? "approved by R&D" : "returned by R&D"}`,
    heading: approved ? "Approved by the R&D section" : "Returned by the R&D section",
    paragraphs: approved
      ? [
          `Hello ${application.student.user.name},`,
          `Your ${application.milestone.name} application was approved by the R&D section. You are cleared for the ${
            application.milestone.code === "DEGREE" ? "degree completion process" : "Doctoral Committee meeting"
          }; the R&D section will record its completion afterwards.`,
          ...(body.data.remarks ? [`R&D remarks:\n${body.data.remarks}`] : []),
        ]
      : [
          `Hello ${application.student.user.name},`,
          `Your ${application.milestone.name} application was returned by the R&D section with the remarks below. Please revise your documents and resubmit.`,
          `Remarks:\n${body.data.remarks}`,
        ],
    cta: { label: "View the application", url: appUrl(`/student/milestones/${application.milestone.code}`) },
  });

  // The supervisor is kept in the loop when R&D returns an application they had approved.
  if (!approved && application.student.supervisor) {
    await sendEmail({
      to: application.student.supervisor.user.email,
      subject: `${application.milestone.code} application returned by R&D`,
      heading: "An application you approved was returned",
      paragraphs: [
        `The ${application.milestone.name} application of ${application.student.user.name} was returned by the R&D section. The scholar has been asked to revise and resubmit.`,
        `R&D remarks:\n${body.data.remarks}`,
      ],
      cta: { label: "Open the scholar", url: appUrl(`/staff/students/${application.studentId}`) },
    });
  }

  return NextResponse.json({ ok: true });
}
