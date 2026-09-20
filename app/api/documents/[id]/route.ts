import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, relationToStudent } from "@/lib/authz";
import { jsonError, requireUuidParam } from "@/lib/api";
import { deleteObject, streamObjectResponse } from "@/lib/storage";
import { isEditableStatus } from "@/lib/milestones";
import { audit } from "@/lib/audit";

/**
 * Authenticated document proxy. The bucket is never exposed to the browser:
 * this route checks the viewer's relationship to the student (owner /
 * supervisor / co-supervisor / admin) and streams the object itself.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return jsonError(401, "Not authenticated");
  if (user.mustChangePassword) return jsonError(403, "Password change required");

  const bad = requireUuidParam(params.id);
  if (bad) return bad;

  const doc = await prisma.milestoneDocument.findUnique({
    where: { id: params.id },
    include: { application: { select: { studentId: true } } },
  });
  if (!doc) return jsonError(404, "Not found");

  const relation = await relationToStudent(user, doc.application.studentId);
  if (!relation) return jsonError(403, "Forbidden");

  return streamObjectResponse(doc.storageKey, doc.fileName, doc.contentType);
}

/** Students may remove a document while the application is still editable. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user || user.role !== "STUDENT") return jsonError(403, "Forbidden");
  if (user.mustChangePassword) return jsonError(403, "Password change required");

  const bad = requireUuidParam(params.id);
  if (bad) return bad;

  const doc = await prisma.milestoneDocument.findUnique({
    where: { id: params.id },
    include: { application: { include: { student: { select: { userId: true } } } } },
  });
  if (!doc || doc.application.student.userId !== user.id) return jsonError(404, "Not found");
  if (!isEditableStatus(doc.application.status)) {
    return jsonError(409, "Documents can only be removed while the application is editable");
  }

  await prisma.milestoneDocument.delete({ where: { id: doc.id } });
  await deleteObject(doc.storageKey);

  await audit({
    actorId: user.id,
    action: "DOCUMENT_DELETED",
    entityType: "MilestoneDocument",
    entityId: doc.id,
    details: { applicationId: doc.applicationId, docType: doc.docType },
  });

  return NextResponse.json({ ok: true });
}
