import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { jsonError, parseBody } from "@/lib/api";
import { uploadIntentSchema } from "@/lib/schemas";
import { ALLOWED_UPLOAD_TYPES, isEditableStatus, MAX_UPLOAD_BYTES } from "@/lib/milestones";
import { milestoneKey, presignUpload, proposalKey, storageConfigured } from "@/lib/storage";

/**
 * Step 1 of an upload: mint a short-lived presigned PUT URL.
 *
 * This is the security boundary for writes: URLs are only issued to the student
 * who owns the target (milestone application or proposal), only while that
 * target is editable, and only for allowed types/sizes. The Content-Type is
 * bound into the signature; the size is verified again by
 * /api/documents/register (HeadObject) before anything is recorded.
 */
export async function POST(req: Request) {
  const auth = await requireRole("STUDENT");
  if (auth.error) return auth.error;
  if (!storageConfigured()) return jsonError(503, "File storage is not configured");

  const body = await parseBody(req, uploadIntentSchema);
  if (body.error) return body.error;
  const intent = body.data;

  if (intent.size > MAX_UPLOAD_BYTES) return jsonError(400, "File exceeds the 10MB limit");

  if (intent.kind === "proposal") {
    if (intent.contentType !== "application/pdf") return jsonError(400, "The proposal document must be a PDF");

    const profile = await prisma.studentProfile.findUnique({ where: { userId: auth.user.id } });
    if (!profile) return jsonError(404, "Student profile not found");
    if (profile.supervisorRequestStatus === "ALLOCATED") {
      return jsonError(409, "The proposal is locked once a supervisor has been allocated");
    }

    const key = proposalKey(profile.id, intent.fileName);
    const url = await presignUpload(key, intent.contentType);
    return NextResponse.json({ url, key });
  }

  if (!ALLOWED_UPLOAD_TYPES.includes(intent.contentType)) {
    return jsonError(400, "Only PDF, JPG and PNG files are allowed");
  }

  const application = await prisma.milestoneApplication.findUnique({
    where: { id: intent.applicationId },
    include: { milestone: true, student: { select: { userId: true } } },
  });
  if (!application || application.student.userId !== auth.user.id) {
    return jsonError(404, "Application not found");
  }
  if (!isEditableStatus(application.status)) {
    return jsonError(409, "This application is not editable right now");
  }
  if (!application.milestone.requiredDocs.includes(intent.docType)) {
    return jsonError(400, "This document type is not required for this milestone");
  }

  const key = milestoneKey(application.id, intent.docType, intent.fileName);
  const url = await presignUpload(key, intent.contentType);
  return NextResponse.json({ url, key });
}
