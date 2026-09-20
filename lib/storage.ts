import { NextResponse } from "next/server";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomBytes } from "crypto";
import { isUuid, jsonError } from "@/lib/api";

/**
 * S3-compatible object storage (Neon Object Storage). Files are addressed by an
 * object KEY that is stored in the database; a URL is never persisted and never
 * reaches the browser. Reads go through the authenticated proxies below.
 *
 * Uploads: the browser asks /api/upload for a short-lived presigned PUT URL,
 * PUTs the bytes straight to the bucket (keeps large files off the Vercel
 * function body limit), then calls /api/documents/register which verifies the
 * object with HeadObject before recording it.
 */

export const BUCKET = process.env.S3_BUCKET ?? "scholar-neon-storage";
const UPLOAD_URL_TTL_SECONDS = 5 * 60;

const globalForS3 = globalThis as unknown as { s3?: S3Client };

function s3(): S3Client {
  if (!globalForS3.s3) {
    globalForS3.s3 = new S3Client({
      endpoint: process.env.AWS_ENDPOINT_URL_S3,
      region: process.env.AWS_REGION ?? "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
      },
      forcePathStyle: true, // Neon Object Storage supports path-style addressing only
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }
  return globalForS3.s3;
}

export function storageConfigured(): boolean {
  return !!(process.env.AWS_ENDPOINT_URL_S3 && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
}

export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "document";
  const cleaned = base.replace(/[^\w.\- ]/g, "_").replace(/\s+/g, " ").trim();
  return (cleaned || "document").slice(0, 120);
}

function nonce(): string {
  return randomBytes(16).toString("hex"); // 128 bits: keys are unguessable
}

// documents/{applicationId}/{docType}/{nonce}-{fileName}
// proposal/{studentProfileId}/{nonce}-{fileName}
const KEY_RE =
  /^(?:documents\/([0-9a-f-]{36})\/([a-z0-9_]{1,60})|proposal\/([0-9a-f-]{36}))\/([0-9a-f]{32})-([^/]{1,120})$/i;

export type ParsedKey =
  | { kind: "milestone"; applicationId: string; docType: string; fileName: string }
  | { kind: "proposal"; studentProfileId: string; fileName: string };

export function milestoneKey(applicationId: string, docType: string, fileName: string): string {
  return `documents/${applicationId}/${docType}/${nonce()}-${sanitizeFileName(fileName)}`;
}

export function proposalKey(studentProfileId: string, fileName: string): string {
  return `proposal/${studentProfileId}/${nonce()}-${sanitizeFileName(fileName)}`;
}

export function parseKey(key: string): ParsedKey | null {
  const m = KEY_RE.exec(key);
  if (!m) return null;
  const [, applicationId, docType, studentProfileId, , fileName] = m;
  if (applicationId) {
    if (!isUuid(applicationId)) return null;
    return { kind: "milestone", applicationId, docType: docType.toLowerCase(), fileName };
  }
  if (!isUuid(studentProfileId)) return null;
  return { kind: "proposal", studentProfileId, fileName };
}

/** Short-lived URL the browser PUTs the file to. Content-Type is part of the signature. */
export function presignUpload(key: string, contentType: string): Promise<string> {
  return getSignedUrl(s3(), new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }), {
    expiresIn: UPLOAD_URL_TTL_SECONDS,
  });
}

export async function headObject(key: string): Promise<{ size: number; contentType: string } | null> {
  try {
    const res = await s3().send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return { size: res.ContentLength ?? 0, contentType: res.ContentType ?? "application/octet-stream" };
  } catch (e) {
    const status = (e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 404 || (e as Error).name === "NotFound") return null;
    throw e;
  }
}

/** Best-effort delete: never throws (the DB row is the source of truth). */
export async function deleteObject(key: string | null | undefined): Promise<void> {
  if (!key || !parseKey(key)) return; // legacy/foreign values are not ours to delete
  try {
    await s3().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch (e) {
    console.error("object delete failed", key, e);
  }
}

/**
 * Stream an object through the server after authorization. The bucket itself
 * is never exposed to the client.
 */
export async function streamObjectResponse(key: string, fileName: string, contentType: string): Promise<NextResponse> {
  // Rows written before the storage migration hold a Vercel Blob URL; those files were not moved.
  if (!parseKey(key)) return jsonError(410, "This file is no longer available");

  let res;
  try {
    res = await s3().send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch (e) {
    console.error("object fetch failed", key, e);
    return jsonError(502, "File is unavailable");
  }
  if (!res.Body) return jsonError(502, "File is unavailable");

  const safeName = fileName.replace(/[^\w.\- ]/g, "_");
  return new NextResponse(res.Body.transformToWebStream(), {
    headers: {
      "Content-Type": contentType,
      ...(res.ContentLength ? { "Content-Length": String(res.ContentLength) } : {}),
      "Content-Disposition": `inline; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      // Neutralize any active content in uploaded files rendered inline.
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
