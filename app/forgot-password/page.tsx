"use client";

import { useState } from "react";
import Link from "next/link";
import AuthLayout from "@/components/AuthLayout";
import Alert from "@/components/Alert";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Could not send the reset email");
      return;
    }
    setSent(true);
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter the email address on your account and we will send you a link to choose a new password."
      image="reading"
      footer={
        <>
          Remembered it?{" "}
          <Link href="/login" className="link font-medium">
            Back to sign in
          </Link>
        </>
      }
    >
      {sent ? (
        <div className="space-y-3">
          <Alert tone="success" title="Check your inbox">
            If an account exists for <strong className="text-fg">{email}</strong>, a reset link is on its way. The link is valid for one hour.
          </Alert>
          <p className="text-sm text-muted">Did not get it? Check your spam folder, or try again in a few minutes.</p>
          <button type="button" className="btn-default w-full" onClick={() => setSent(false)}>
            Send another link
          </button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          {error && (
            <Alert tone="error" title="Something went wrong" dismissible>
              {error}
            </Alert>
          )}
          <div>
            <label className="label" htmlFor="email">
              Email address
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              autoFocus
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
