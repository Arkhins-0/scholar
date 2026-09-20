import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { jsonError, requireUuidParam } from "@/lib/api";
import { nextStage } from "@/lib/milestones";
import { audit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { appUrl } from "@/lib/site";
import { fmtDate } from "@/lib/format";

/**
 * R&D marks the DC meeting as completed (or, for DEGREE, issues the degree).
 * This is what unlocks the next milestone for the student.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole("RND_ADMIN");
  if (auth.error) return auth.error;

  const bad = requireUuidParam(params.id);
  if (bad) return bad;

  const application = await prisma.milestoneApplication.findUnique({
    where: { id: params.id },
    include: {
      milestone: true,
      student: { include: { user: { select: { email: true, name: true } } } },
    },
  });
  if (!application) return jsonError(404, "Application not found");
  if (application.status !== "RND_APPROVED") {
    return jsonError(409, "Only R&D-approved applications can be marked completed");
  }

  const isDegree = application.milestone.code === "DEGREE";
  const now = new Date();
  const newStage = nextStage(application.milestone.code); // DC1→DC2 … DEGREE→COMPLETED

  await prisma.$transaction([
    prisma.milestoneApplication.update({
      where: { id: application.id },
      data: isDegree
        ? { status: "DEGREE_ISSUED", degreeIssuedAt: now }
        : { status: "MEETING_COMPLETED", meetingCompletedAt: now },
    }),
    prisma.studentProfile.update({
      where: { id: application.studentId },
      data: { currentMilestoneCode: newStage ?? application.milestone.code },
    }),
  ]);

  await audit({
    actorId: auth.user.id,
    action: isDegree ? "DEGREE_ISSUED" : "MEETING_COMPLETED",
    entityType: "MilestoneApplication",
    entityId: application.id,
    details: { milestone: application.milestone.code },
  });

  await sendEmail({
    to: application.student.user.email,
    subject: isDegree ? "Degree issued. Congratulations!" : `${application.milestone.code} meeting completed`,
    heading: isDegree ? "Congratulations, Doctor!" : `${application.milestone.name} completed`,
    paragraphs: isDegree
      ? [
          `Hello ${application.student.user.name},`,
          `The R&D section has issued your degree as of ${fmtDate(now)}. This completes your PhD journey on the portal; the completion record is now on your dashboard.`,
        ]
      : [
          `Hello ${application.student.user.name},`,
          `The R&D section has recorded your ${application.milestone.name} as completed. The next stage${newStage ? ` (${newStage})` : ""} is now unlocked.`,
        ],
    cta: { label: "Open your dashboard", url: appUrl("/student/dashboard") },
  });

  return NextResponse.json({ ok: true });
}
