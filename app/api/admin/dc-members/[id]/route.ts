import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { jsonError, parseBody, requireUuidParam } from "@/lib/api";
import { dcMemberUpdateSchema } from "@/lib/schemas";
import { audit } from "@/lib/audit";

/** R&D: edit a DC member (details or active flag). */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole("RND_ADMIN");
  if (auth.error) return auth.error;

  const bad = requireUuidParam(params.id);
  if (bad) return bad;

  const body = await parseBody(req, dcMemberUpdateSchema);
  if (body.error) return body.error;

  const member = await prisma.dcMember.findUnique({ where: { id: params.id } });
  if (!member) return jsonError(404, "DC member not found");

  const { name, email, department, designation, affiliation, isActive } = body.data;

  if (email && email !== member.email) {
    const clash = await prisma.dcMember.findUnique({ where: { email } });
    if (clash) return jsonError(409, "A DC member with this email already exists");
  }

  await prisma.dcMember.update({
    where: { id: member.id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(email !== undefined ? { email: email || null } : {}),
      ...(department !== undefined ? { department: department || null } : {}),
      ...(designation !== undefined ? { designation: designation || null } : {}),
      ...(affiliation !== undefined ? { affiliation: affiliation || null } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    },
  });

  await audit({
    actorId: auth.user.id,
    action: "DC_MEMBER_UPDATED",
    entityType: "DcMember",
    entityId: member.id,
  });

  return NextResponse.json({ ok: true });
}

/**
 * R&D: remove a DC member. If they are still assigned to any student's
 * committee, soft-delete (deactivate) to preserve committee history; otherwise
 * hard-delete.
 */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole("RND_ADMIN");
  if (auth.error) return auth.error;

  const bad = requireUuidParam(params.id);
  if (bad) return bad;

  const member = await prisma.dcMember.findUnique({
    where: { id: params.id },
    include: { _count: { select: { memberships: true } } },
  });
  if (!member) return jsonError(404, "DC member not found");

  if (member._count.memberships > 0) {
    await prisma.dcMember.update({ where: { id: member.id }, data: { isActive: false } });
    await audit({
      actorId: auth.user.id,
      action: "DC_MEMBER_DEACTIVATED",
      entityType: "DcMember",
      entityId: member.id,
    });
    return NextResponse.json({ ok: true, deactivated: true });
  }

  await prisma.dcMember.delete({ where: { id: member.id } });
  await audit({
    actorId: auth.user.id,
    action: "DC_MEMBER_DELETED",
    entityType: "DcMember",
    entityId: member.id,
  });
  return NextResponse.json({ ok: true, deleted: true });
}
