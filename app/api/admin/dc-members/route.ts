import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { jsonError, parseBody } from "@/lib/api";
import { dcMemberCreateSchema } from "@/lib/schemas";
import { audit } from "@/lib/audit";

/** R&D: list the Doctoral Committee member pool. */
export async function GET() {
  const auth = await requireRole("RND_ADMIN");
  if (auth.error) return auth.error;

  const members = await prisma.dcMember.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: { _count: { select: { memberships: true } } },
  });
  return NextResponse.json({
    members: members.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      department: m.department,
      designation: m.designation,
      affiliation: m.affiliation,
      isActive: m.isActive,
      assignments: m._count.memberships,
    })),
  });
}

/** R&D: add a new DC member to the pool. */
export async function POST(req: Request) {
  const auth = await requireRole("RND_ADMIN");
  if (auth.error) return auth.error;

  const body = await parseBody(req, dcMemberCreateSchema);
  if (body.error) return body.error;
  const { name, email, department, designation, affiliation } = body.data;

  if (email) {
    const clash = await prisma.dcMember.findUnique({ where: { email } });
    if (clash) return jsonError(409, "A DC member with this email already exists");
  }

  const member = await prisma.dcMember.create({
    data: {
      name,
      email: email || null,
      department: department || null,
      designation: designation || null,
      affiliation: affiliation || null,
    },
  });

  await audit({
    actorId: auth.user.id,
    action: "DC_MEMBER_CREATED",
    entityType: "DcMember",
    entityId: member.id,
    details: { name },
  });

  return NextResponse.json({ id: member.id });
}
