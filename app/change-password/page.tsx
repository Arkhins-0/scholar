"use client";

import { useState } from "react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import AuthLayout from "@/components/AuthLayout";
import Alert from "@/components/Alert";
import { changePasswordSchema } from "@/lib/schemas";

export default function ChangePasswordPage() {
  const { data: session } = useSession();
  const forced = !!session?.user?.mustChangePassword;

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirm) {
      setError("New passwords do not match");
      return;
    }
    const parsed = changePasswordSchema.safeParse({ currentPassword, newPassword });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your input");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Password change failed");
      setBusy(false);
      return;
    }
    // Re-authenticate so the session token drops the must-change flag.
    await signOut({ callbackUrl: "/login" });
  }

  return (
    <AuthLayout
      title="Change your password"
      subtitle="You will be signed out afterwards and can sign in again with the new password."
      image="shelves"
      footer={
        forced ? undefined : (
          <Link href="/" className="link font-medium">
            Back to your dashboard
          </Link>
        )
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {forced && (
          <Alert tone="warn" title="Temporary password in use">
            Your account was issued a temporary password. Set a new one to continue.
          </Alert>
        )}
        {error && (
          <Alert tone="error" title="Update failed" dismissible>
            {error}
          </Alert>
        )}
        <div>
          <label className="label" htmlFor="current">
            Current password
          </label>
          <input
            id="current"
            type="password"
            required
            autoFocus
            autoComplete="current-password"
            className="input"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="new">
            New password
          </label>
          <input
            id="new"
            type="password"
            required
            autoComplete="new-password"
            className="input"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <p className="hint">At least 10 characters, including a letter and a digit.</p>
        </div>
        <div>
          <label className="label" htmlFor="confirm">
            Confirm new password
          </label>
          <input
            id="confirm"
            type="password"
            required
            autoComplete="new-password"
            className="input"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? "Updating…" : "Update password"}
        </button>
      </form>
    </AuthLayout>
  );
}
