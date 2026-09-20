"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound } from "lucide-react";
import Alert from "@/components/Alert";

export default function PortalKeyGenerator() {
  const router = useRouter();
  const [count, setCount] = useState(1);
  const [expiresInDays, setExpiresInDays] = useState<string>("");
  const [keys, setKeys] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    setCopied(false);
    const res = await fetch("/api/admin/portal-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        count,
        ...(expiresInDays ? { expiresInDays: Number(expiresInDays) } : {}),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Key generation failed");
      return;
    }
    const data = await res.json();
    setKeys(data.keys);
    router.refresh();
  }

  async function copyAll() {
    await navigator.clipboard.writeText(keys.join("\n"));
    setCopied(true);
  }

  return (
    <div className="box">
      <div className="box-header">
        <h2 className="box-title flex items-center gap-2">
          <KeyRound size={15} className="text-muted" /> Generate portal keys
        </h2>
      </div>
      <form onSubmit={generate} className="box-body flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="count">
            How many
          </label>
          <input
            id="count"
            type="number"
            min={1}
            max={50}
            className="input w-24"
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="label" htmlFor="expires">
            Expires in days
          </label>
          <input
            id="expires"
            type="number"
            min={1}
            max={365}
            placeholder="never"
            className="input w-32"
            value={expiresInDays}
            onChange={(e) => setExpiresInDays(e.target.value)}
          />
        </div>
        <button type="submit" disabled={busy} className="btn-primary">
          {busy ? "Generating…" : "Generate"}
        </button>
        {error && <p className="w-full text-sm text-danger">{error}</p>}
      </form>

      {keys.length > 0 && (
        <div className="border-t border-line p-4">
          <Alert
            tone="warn"
            title="Copy these keys now"
            actions={
              <button type="button" onClick={copyAll} className="btn-default btn-sm">
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? "Copied" : "Copy all"}
              </button>
            }
          >
            <p>They are shown once and cannot be recovered. Hand each key to one scholar.</p>
            <ul className="mt-3 divide-y divide-line overflow-hidden rounded-md border border-line bg-surface">
              {keys.map((k) => (
                <li key={k} className="mono px-3 py-1.5 text-fg">
                  {k}
                </li>
              ))}
            </ul>
          </Alert>
        </div>
      )}
    </div>
  );
}
