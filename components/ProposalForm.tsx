"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Lock, Paperclip, Upload } from "lucide-react";
import Alert from "@/components/Alert";
import { proposalSchema } from "@/lib/schemas";
import { RESEARCH_DOMAINS } from "@/lib/domains";
import { MAX_UPLOAD_BYTES, uploadFile } from "@/lib/upload-client";

export default function ProposalForm({
  profileId,
  initial,
  proposalFileName,
  locked,
}: {
  profileId: string;
  initial: { title: string; domain: string };
  proposalFileName: string | null;
  locked: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(initial.title);
  const [domain, setDomain] = useState(initial.domain);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const parsed = proposalSchema.safeParse({ title, domain });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your input");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/proposal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Could not save the proposal");
      return;
    }
    setNotice("Proposal saved.");
    router.refresh();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setNotice(null);

    if (file.type !== "application/pdf") {
      setError("The proposed work must be uploaded as a PDF");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("File exceeds the 10MB limit");
      return;
    }

    setProgress(0);
    try {
      await uploadFile({ kind: "proposal" }, file, setProgress);
      setNotice("Proposed work uploaded.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setProgress(null);
    }
  }

  const busy = saving || progress !== null;

  return (
    <form onSubmit={onSubmit} className="box">
      <div className="box-header">
        <h2 className="box-title flex items-center gap-2">
          <FileText size={15} className="text-muted" /> Proposal details
        </h2>
        {locked && (
          <span className="chip">
            <Lock size={12} /> Locked
          </span>
        )}
      </div>

      <div className="box-body space-y-4">
        {locked && (
          <Alert tone="info" title="Proposal locked">
            A supervisor has been allocated, so the proposal is now read-only.
          </Alert>
        )}
        {error && (
          <Alert tone="error" title="Could not save" dismissible>
            {error}
          </Alert>
        )}
        {notice && (
          <Alert tone="success" title="Saved" dismissible>
            {notice}
          </Alert>
        )}

        <div>
          <label className="label" htmlFor="title">
            Research title
          </label>
          <input
            id="title"
            className="input"
            disabled={locked}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={300}
            placeholder="A concise, descriptive title for the research"
          />
        </div>

        <div>
          <label className="label" htmlFor="domain">
            Research domain
          </label>
          <select id="domain" className="input" disabled={locked} value={domain} onChange={(e) => setDomain(e.target.value)}>
            <option value="">Select a domain</option>
            {RESEARCH_DOMAINS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-lg border border-line">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold">Proposed work (PDF)</div>
              {proposalFileName ? (
                <a
                  href={`/api/students/${profileId}/proposal-document`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-0.5 inline-flex max-w-full items-center gap-1.5 text-sm text-accent hover:underline"
                >
                  <Paperclip size={13} className="shrink-0" />
                  <span className="truncate">{proposalFileName}</span>
                </a>
              ) : (
                <p className="mt-0.5 text-sm text-faint">Not uploaded yet · up to 10MB</p>
              )}
            </div>
            {!locked && (
              <>
                <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={onFile} />
                <button type="button" className="btn-default" disabled={busy} onClick={() => fileRef.current?.click()}>
                  <Upload size={15} />
                  {progress !== null ? `Uploading ${progress}%` : proposalFileName ? "Replace PDF" : "Upload PDF"}
                </button>
              </>
            )}
          </div>
          {progress !== null && (
            <div className="h-0.5 w-full bg-elevated">
              <div className="h-full bg-accent transition-[width]" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
      </div>

      {!locked && (
        <div className="box-footer flex items-center justify-between gap-3">
          <p className="text-xs text-muted">Save the title and domain; the PDF uploads immediately.</p>
          <button type="submit" disabled={busy} className="btn-primary">
            {saving ? "Saving…" : "Save proposal"}
          </button>
        </div>
      )}
    </form>
  );
}
