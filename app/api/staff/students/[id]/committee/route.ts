import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { jsonError, parseBody, requireUuidParam } from "@/lib/api";
import { committeeSchema } from "@/lib/schemas";
import { audit } from "@/lib/audit";

/**
 * Supervisor sets the student's Doctoral Committee (2–5 members drawn from the
 * DC-member pool that R&D curates — a pool kept separate from the staff/
 * supervisor pool).
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole("STAFF");
  if (auth.error) return auth.error;

  const bad = requireUuidParam(params.id);
  if (bad) return bad;

  const body = await parseBody(req, committeeSchema);
  if (body.error) return body.error;
  const { dcMemberIds } = body.data;

  const staff = await prisma.staffProfile.findUnique({ where: { userId: auth.user.id } });
  if (!staff) return jsonError(403, "No staff profile");

  const student = await prisma.studentProfile.findUnique({ where: { id: params.id } });
  if (!student || student.supervisorId !== staff.id) {
    return jsonError(403, "Only the allocated supervisor can set the committee");
  }

  const found = await prisma.dcMember.count({ where: { id: { in: dcMemberIds }, isActive: true } });
  if (found !== dcMemberIds.length) {
    return jsonError(400, "One or more selected DC members are unavailable");
  }

  await prisma.$transaction([
    prisma.dcMembership.deleteMany({ where: { studentId: student.id } }),
    prisma.dcMembership.createMany({
      data: dcMemberIds.map((dcMemberId) => ({ studentId: student.id, dcMemberId })),
    }),
  ]);

  await audit({
    actorId: auth.user.id,
    action: "DC_COMMITTEE_SET",
    entityType: "StudentProfile",
    entityId: student.id,
    details: { dcMemberIds },
  });

  return NextResponse.json({ ok: true });
}
