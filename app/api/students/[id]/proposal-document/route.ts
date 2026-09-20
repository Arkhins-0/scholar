import { prisma } from "@/lib/prisma";
import { getSessionUser, relationToStudent } from "@/lib/authz";
import { jsonError } from "@/lib/api";
import { streamObjectResponse } from "@/lib/storage";

/**
 * Authenticated proxy for the proposal document. Accessible to the student,
 * their supervisor/co-supervisor, and R&D admins.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return jsonError(401, "Not authenticated");
  if (user.mustChangePassword) return jsonError(403, "Password change required");

  const relation = await relationToStudent(user, params.id);
  if (!relation) return jsonError(403, "Forbidden");

  const profile = await prisma.studentProfile.findUnique({
    where: { id: params.id },
    select: { proposalStorageKey: true, proposalFileName: true, proposalContentType: true },
  });
  if (!profile?.proposalStorageKey) return jsonError(404, "No proposal document uploaded");

  return streamObjectResponse(
    profile.proposalStorageKey,
    profile.proposalFileName ?? "proposal.pdf",
    profile.proposalContentType ?? "application/pdf"
  );
}
