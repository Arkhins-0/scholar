"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, FileText, Paperclip, Trash2, Upload } from "lucide-react";
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES, formatBytes, uploadFile } from "@/lib/upload-client";
import { fmtDate } from "@/lib/format";

type Doc = { id: string; fileName: string; size: number; uploadedAt: string };

/** One required document slot: label, upload control, list of uploaded files. */
export default function DocumentUpload({
  applicationId,
  docType,
  label,
  editable,
  docs,
}: {
  applicationId: string;
  docType: string;
  label: string;
  editable: boolean;
  docs: Doc[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);

    if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) {
      setError("Only PDF, JPG and PNG files are allowed");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("File exceeds the 10MB limit");
      return;
    }

    setProgress(0);
    try {
      await uploadFile({ kind: "milestone", applicationId, docType }, file, setProgress);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setProgress(null);
    }
  }

  async function remove(id: string) {
    setError(null);
    const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Could not remove the document");
      return;
    }
    router.refresh();
  }

  const satisfied = docs.length > 0;
  const busy = progress !== null;

  return (
    <div className="box">
      <div className="box-header">
        <div className="flex items-center gap-3">
          <span
            className={`flex h-7 w-7 items-center justify-center border ${
              satisfied ? "border-success/40 bg-success/10 text-success" : "border-line bg-surface text-faint"
            }`}
          >
            {satisfied ? <Check size={15} /> : <FileText size={15} />}
          </span>
          <div>
            <div className="box-title">{label}</div>
            <div className="text-xs text-muted">PDF, JPG or PNG · up to 10MB</div>
          </div>
        </div>
        {editable && (
          <>
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={onFile} />
            <button type="button" className="btn-default" disabled={busy} onClick={() => fileRef.current?.click()}>
              <Upload size={15} />
              {busy ? `Uploading ${progress}%` : docs.length > 0 ? "Add another" : "Upload"}
            </button>
          </>
        )}
      </div>

      {busy && (
        <div className="h-0.5 w-full bg-elevated">
          <div className="h-full bg-accent transition-[width]" style={{ width: `${progress}%` }} />
        </div>
      )}

      {error && <p className="flash-error border-x-0 border-t-0">{error}</p>}

      {docs.length === 0 ? (
        <p className="px-4 py-3 text-sm text-faint">Nothing uploaded yet.</p>
      ) : (
        <ul>
          {docs.map((d) => (
            <li key={d.id} className="box-row flex items-center justify-between gap-3">
              <a
                href={`/api/documents/${d.id}`}
                target="_blank"
                rel="noreferrer"
                className="flex min-w-0 items-center gap-2 text-sm font-medium text-accent hover:underline"
              >
                <Paperclip size={14} className="shrink-0 text-faint" />
                <span className="truncate">{d.fileName}</span>
              </a>
              <div className="flex shrink-0 items-center gap-3 text-xs text-muted">
                {d.size > 0 && <span className="hidden sm:inline">{formatBytes(d.size)}</span>}
                <span>{fmtDate(d.uploadedAt)}</span>
                {editable && (
                  <button
                    type="button"
                    onClick={() => remove(d.id)}
                    title="Remove"
                    aria-label={`Remove ${d.fileName}`}
                    className="btn-invisible btn-sm btn-icon text-danger hover:text-danger"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
