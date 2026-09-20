import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { jsonError, parseBody, requireUuidParam } from "@/lib/api";
import { staffUpdateSchema } from "@/lib/schemas";
import { audit } from "@/lib/audit";

/** Edit a staff member's details. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole("RND_ADMIN");
  if (auth.error) return auth.error;

  const bad = requireUuidParam(params.id);
  if (bad) return bad;

  const body = await parseBody(req, staffUpdateSchema);
  if (body.error) return body.error;

  const staff = await prisma.staffProfile.findUnique({ where: { id: params.id } });
  if (!staff) return jsonError(404, "Staff member not found");

  const { name, phone, department, designation } = body.data;
  await prisma.$transaction([
    prisma.user.update({
      where: { id: staff.userId },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(phone !== undefined ? { phone: phone || null } : {}),
      },
    }),
    prisma.staffProfile.update({
      where: { id: staff.id },
      data: {
        ...(department !== undefined ? { department: department || null } : {}),
        ...(designation !== undefined ? { designation: designation || null } : {}),
      },
    }),
  ]);

  await audit({
    actorId: auth.user.id,
    action: "STAFF_UPDATED",
    entityType: "StaffProfile",
    entityId: staff.id,
  });

  return NextResponse.json({ ok: true });
}
