import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { jsonError, parseBody } from "@/lib/api";
import { proposalSchema } from "@/lib/schemas";
import { audit } from "@/lib/audit";

/** Create/update the student's research proposal (title, domain, proposed work). */
export async function POST(req: Request) {
  const auth = await requireRole("STUDENT");
  if (auth.error) return auth.error;

  const body = await parseBody(req, proposalSchema);
  if (body.error) return body.error;

  const profile = await prisma.studentProfile.findUnique({ where: { userId: auth.user.id } });
  if (!profile) return jsonError(404, "Student profile not found");
  if (profile.supervisorRequestStatus === "ALLOCATED") {
    return jsonError(409, "The proposal is locked once a supervisor has been allocated");
  }

  await prisma.studentProfile.update({
    where: { id: profile.id },
    data: {
      title: body.data.title,
      domain: body.data.domain,
    },
  });

  await audit({
    actorId: auth.user.id,
    action: "PROPOSAL_UPDATED",
    entityType: "StudentProfile",
    entityId: profile.id,
  });

  return NextResponse.json({ ok: true });
}
