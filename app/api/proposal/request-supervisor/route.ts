import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { jsonError } from "@/lib/api";
import { audit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { appUrl } from "@/lib/site";

/** Student requests supervisor allocation (requires a complete proposal). */
export async function POST() {
  const auth = await requireRole("STUDENT");
  if (auth.error) return auth.error;

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: auth.user.id },
    include: { user: { select: { name: true } } },
  });
  if (!profile) return jsonError(404, "Student profile not found");
  if (!profile.title || !profile.domain || !profile.proposalStorageKey) {
    return jsonError(
      400,
      "Complete the proposal (title, domain and the proposed-work PDF) before requesting a supervisor"
    );
  }
  if (profile.supervisorRequestStatus === "PENDING") {
    return jsonError(409, "A supervisor request is already pending");
  }
  if (profile.supervisorRequestStatus === "ALLOCATED") {
    return jsonError(409, "A supervisor has already been allocated");
  }

  await prisma.studentProfile.update({
    where: { id: profile.id },
    data: { supervisorRequestStatus: "PENDING" },
  });

  await audit({
    actorId: auth.user.id,
    action: "SUPERVISOR_REQUESTED",
    entityType: "StudentProfile",
    entityId: profile.id,
  });

  const admins = await prisma.user.findMany({ where: { role: "RND_ADMIN" }, select: { email: true } });
  await Promise.all(
    admins.map((a) =>
      sendEmail({
        to: a.email,
        subject: "New supervisor allocation request",
        heading: "A scholar is waiting for a supervisor",
        paragraphs: [
          `${profile.user.name} has completed their proposal and requested supervisor allocation.`,
          `Title: ${profile.title}\nDomain: ${profile.domain}`,
        ],
        cta: { label: "Open supervisor requests", url: appUrl("/admin/supervisor-requests") },
      })
    )
  );

  return NextResponse.json({ ok: true });
}
