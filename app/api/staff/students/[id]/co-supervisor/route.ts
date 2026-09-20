import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { jsonError, parseBody, requireUuidParam } from "@/lib/api";
import { coSupervisorSchema } from "@/lib/schemas";
import { audit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { appUrl } from "@/lib/site";

/** Supervisor assigns (or clears) the co-supervisor for their student. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole("STAFF");
  if (auth.error) return auth.error;

  const bad = requireUuidParam(params.id);
  if (bad) return bad;

  const body = await parseBody(req, coSupervisorSchema);
  if (body.error) return body.error;
  const { coSupervisorId } = body.data;

  const staff = await prisma.staffProfile.findUnique({ where: { userId: auth.user.id } });
  if (!staff) return jsonError(403, "No staff profile");

  const student = await prisma.studentProfile.findUnique({
    where: { id: params.id },
    include: { user: { select: { name: true } } },
  });
  if (!student || student.supervisorId !== staff.id) {
    return jsonError(403, "Only the allocated supervisor can assign a co-supervisor");
  }

  if (coSupervisorId === staff.id) {
    return jsonError(400, "The supervisor cannot also be the co-supervisor");
  }

  let coSupervisor = null;
  if (coSupervisorId) {
    coSupervisor = await prisma.staffProfile.findUnique({
      where: { id: coSupervisorId },
      include: { user: { select: { email: true, name: true } } },
    });
    if (!coSupervisor) return jsonError(400, "Selected staff member does not exist");
  }

  await prisma.studentProfile.update({
    where: { id: student.id },
    data: { coSupervisorId: coSupervisorId ?? null },
  });

  await audit({
    actorId: auth.user.id,
    action: coSupervisorId ? "CO_SUPERVISOR_ASSIGNED" : "CO_SUPERVISOR_CLEARED",
    entityType: "StudentProfile",
    entityId: student.id,
    details: { coSupervisorId },
  });

  if (coSupervisor) {
    await sendEmail({
      to: coSupervisor.user.email,
      subject: "You have been assigned as a co-supervisor",
      heading: "You are now a co-supervisor",
      paragraphs: [
        `Hello ${coSupervisor.user.name},`,
        `${auth.user.name ?? "The supervisor"} has assigned you as co-supervisor for ${student.user.name}. You can follow the scholar's progress and documents from your dashboard.`,
      ],
      cta: { label: "Open the scholar", url: appUrl(`/staff/students/${student.id}`) },
    });
  }

  return NextResponse.json({ ok: true });
}
