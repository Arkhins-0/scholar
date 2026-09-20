import { prisma } from "@/lib/prisma";
import { isMilestoneCode, previousMilestone, type MilestoneCode } from "@/lib/milestones";

export type GateResult = { allowed: true } | { allowed: false; reason: string };

/**
 * Server-side milestone gate — the single source of truth for whether a student
 * may open/work on a milestone application. Enforced in the API routes; the UI
 * only mirrors it.
 */
export async function canOpenMilestone(studentProfileId: string, code: string): Promise<GateResult> {
  if (!isMilestoneCode(code)) return { allowed: false, reason: "Unknown milestone" };

  const student = await prisma.studentProfile.findUnique({
    where: { id: studentProfileId },
    select: {
      supervisorId: true,
      applications: {
        select: { status: true, milestone: { select: { code: true } } },
      },
    },
  });
  if (!student) return { allowed: false, reason: "Student not found" };

  if (!student.supervisorId) {
    return { allowed: false, reason: "A supervisor must be allocated before milestone applications open" };
  }

  const prev = previousMilestone(code as MilestoneCode);
  if (prev) {
    const prevApp = student.applications.find((a) => a.milestone.code === prev);
    if (!prevApp || prevApp.status !== "MEETING_COMPLETED") {
      return { allowed: false, reason: `${prev} must be completed (meeting held) before ${code} unlocks` };
    }
  }
  return { allowed: true };
}
