import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { jsonError, parseBody } from "@/lib/api";
import { registerDocumentSchema } from "@/lib/schemas";
import { ALLOWED_UPLOAD_TYPES, isEditableStatus, MAX_UPLOAD_BYTES } from "@/lib/milestones";
import { deleteObject, headObject, parseKey } from "@/lib/storage";
import { audit } from "@/lib/audit";

/**
 * Step 2 of an upload: record an object the browser just PUT to storage.
 *
 * The key is never trusted as-is: it must match our key grammar, point at an
 * editable target owned by the calling student, and HeadObject must confirm the
 * object exists with an allowed type and size (oversized objects are deleted).
 */
export async function POST(req: Request) {
  const auth = await requireRole("STUDENT");
  if (auth.error) return auth.error;

  const body = await parseBody(req, registerDocumentSchema);
  if (body.error) return body.error;

  const key = body.data.key;
  const parsed = parseKey(key);
  if (!parsed) return jsonError(400, "Invalid file key");

  const object = await headObject(key);
  if (!object) return jsonError(400, "Upload not found. Please try again.");
  if (object.size > MAX_UPLOAD_BYTES) {
    await deleteObject(key);
    return jsonError(400, "File exceeds the 10MB limit");
  }

  if (parsed.kind === "proposal") {
    const profile = await prisma.studentProfile.findUnique({ where: { id: parsed.studentProfileId } });
    if (!profile || profile.userId !== auth.user.id) return jsonError(404, "Profile not found");
    if (profile.supervisorRequestStatus === "ALLOCATED") {
      await deleteObject(key);
      return jsonError(409, "The proposal is locked once a supervisor has been allocated");
    }
    if (object.contentType !== "application/pdf") {
      await deleteObject(key);
      return jsonError(400, "The proposal document must be a PDF");
    }

    const previous = profile.proposalStorageKey;
    await prisma.studentProfile.update({
      where: { id: profile.id },
      data: {
        proposalStorageKey: key,
        proposalFileName: parsed.fileName,
        proposalContentType: object.contentType,
        proposalSize: object.size,
      },
    });
    if (previous && previous !== key) await deleteObject(previous);

    await audit({
      actorId: auth.user.id,
      action: "PROPOSAL_DOCUMENT_UPLOADED",
      entityType: "StudentProfile",
      entityId: profile.id,
    });
    return NextResponse.json({ ok: true });
  }

  const application = await prisma.milestoneApplication.findUnique({
    where: { id: parsed.applicationId },
    include: { milestone: true, student: { select: { userId: true } } },
  });
  if (!application || application.student.userId !== auth.user.id) {
    return jsonError(404, "Application not found");
  }
  if (!isEditableStatus(application.status)) {
    await deleteObject(key);
    return jsonError(409, "This application is not editable right now");
  }
  if (!application.milestone.requiredDocs.includes(parsed.docType)) {
    await deleteObject(key);
    return jsonError(400, "This document type is not required for this milestone");
  }
  if (!ALLOWED_UPLOAD_TYPES.includes(object.contentType)) {
    await deleteObject(key);
    return jsonError(400, "Only PDF, JPG and PNG files are allowed");
  }

  // Idempotent: a retried register call for the same object returns the existing row.
  const existing = await prisma.milestoneDocument.findFirst({ where: { storageKey: key } });
  if (existing) return NextResponse.json({ id: existing.id });

  const doc = await prisma.milestoneDocument.create({
    data: {
      applicationId: application.id,
      docType: parsed.docType,
      storageKey: key,
      fileName: parsed.fileName,
      contentType: object.contentType,
      size: object.size,
    },
  });

  await audit({
    actorId: auth.user.id,
    action: "DOCUMENT_UPLOADED",
    entityType: "MilestoneDocument",
    entityId: doc.id,
    details: { applicationId: application.id, docType: parsed.docType },
  });

  return NextResponse.json({ id: doc.id });
}
