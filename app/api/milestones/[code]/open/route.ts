import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { jsonError } from "@/lib/api";
import { canOpenMilestone } from "@/lib/gating";
import { audit } from "@/lib/audit";

/** Opens (creates) the DRAFT application for a milestone, enforcing stage gating. */
export async function POST(_req: Request, { params }: { params: { code: string } }) {
  const auth = await requireRole("STUDENT");
  if (auth.error) return auth.error;

  const code = params.code.toUpperCase();
  const profile = await prisma.studentProfile.findUnique({ where: { userId: auth.user.id } });
  if (!profile) return jsonError(404, "Student profile not found");

  const gate = await canOpenMilestone(profile.id, code);
  if (!gate.allowed) return jsonError(403, gate.reason);

  const milestone = await prisma.milestone.findUnique({ where: { code } });
  if (!milestone) return jsonError(404, "Milestone not found");

  const existing = await prisma.milestoneApplication.findUnique({
    where: { studentId_milestoneId: { studentId: profile.id, milestoneId: milestone.id } },
  });
  if (existing) return NextResponse.json({ id: existing.id });

  const application = await prisma.milestoneApplication.create({
    data: { studentId: profile.id, milestoneId: milestone.id, status: "DRAFT" },
  });

  await audit({
    actorId: auth.user.id,
    action: "APPLICATION_OPENED",
    entityType: "MilestoneApplication",
    entityId: application.id,
    details: { milestone: code },
  });

  return NextResponse.json({ id: application.id });
}
