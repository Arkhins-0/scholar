"use client";

/**
 * Browser side of the two-step upload (see lib/storage.ts):
 *   1. POST /api/upload            -> presigned PUT URL + object key
 *   2. PUT the bytes to storage    -> progress reported via XHR
 *   3. POST /api/documents/register -> server verifies the object and records it
 */
export type UploadIntent =
  | { kind: "milestone"; applicationId: string; docType: string }
  | { kind: "proposal" };

export const ALLOWED_UPLOAD_TYPES = ["application/pdf", "image/jpeg", "image/png"];
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

async function readError(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => null);
  return (data as { error?: string } | null)?.error ?? fallback;
}

function putWithProgress(url: string, file: File, onProgress?: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Storage rejected the upload (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Network error while uploading"));
    xhr.onabort = () => reject(new Error("Upload cancelled"));
    xhr.send(file);
  });
}

export async function uploadFile(
  intent: UploadIntent,
  file: File,
  onProgress?: (pct: number) => void
): Promise<{ key: string; id?: string }> {
  const start = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...intent, fileName: file.name, contentType: file.type, size: file.size }),
  });
  if (!start.ok) throw new Error(await readError(start, "Could not start the upload"));
  const { url, key } = (await start.json()) as { url: string; key: string };

  await putWithProgress(url, file, onProgress);

  const done = await fetch("/api/documents/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  });
  if (!done.ok) throw new Error(await readError(done, "Could not record the upload"));
  const data = (await done.json()) as { id?: string };
  return { key, id: data.id };
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
