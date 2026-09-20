import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { jsonError, parseBody } from "@/lib/api";
import { allocateSupervisorSchema } from "@/lib/schemas";
import { audit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { appUrl } from "@/lib/site";

/** R&D allocates a supervisor to a student with a PENDING request. */
export async function POST(req: Request) {
  const auth = await requireRole("RND_ADMIN");
  if (auth.error) return auth.error;

  const body = await parseBody(req, allocateSupervisorSchema);
  if (body.error) return body.error;
  const { studentId, staffId } = body.data;

  const student = await prisma.studentProfile.findUnique({
    where: { id: studentId },
    include: { user: { select: { email: true, name: true } } },
  });
  if (!student) return jsonError(404, "Student not found");
  if (student.supervisorRequestStatus !== "PENDING") {
    return jsonError(409, "This student has no pending supervisor request");
  }

  const staff = await prisma.staffProfile.findUnique({
    where: { id: staffId },
    include: { user: { select: { email: true, name: true } } },
  });
  if (!staff) return jsonError(400, "Selected staff member does not exist");

  await prisma.studentProfile.update({
    where: { id: student.id },
    data: {
      supervisorId: staff.id,
      supervisorRequestStatus: "ALLOCATED",
      // supervisor allocation moves the journey from PROPOSAL to DC1
      ...(student.currentMilestoneCode === "PROPOSAL" ? { currentMilestoneCode: "DC1" } : {}),
    },
  });

  await audit({
    actorId: auth.user.id,
    action: "SUPERVISOR_ALLOCATED",
    entityType: "StudentProfile",
    entityId: student.id,
    details: { staffId: staff.id },
  });

  await Promise.all([
    sendEmail({
      to: student.user.email,
      subject: "Supervisor allocated",
      heading: "Your supervisor has been allocated",
      paragraphs: [
        `Hello ${student.user.name},`,
        `${staff.user.name} has been allocated as your supervisor by the R&D section. Your proposal is now locked and the DC1 stage is open. Upload the required documents when you are ready.`,
      ],
      cta: { label: "Start your DC1 application", url: appUrl("/student/milestones/DC1") },
    }),
    sendEmail({
      to: staff.user.email,
      subject: "New scholar allocated to you",
      heading: "A scholar has been allocated to you",
      paragraphs: [
        `Hello ${staff.user.name},`,
        `You have been allocated as supervisor for ${student.user.name}. Please review their proposal and constitute their Doctoral Committee (2 to 5 members, optional co-supervisor).`,
      ],
      cta: { label: "Open the scholar", url: appUrl(`/staff/students/${student.id}`) },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
