"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { registerSchema } from "@/lib/schemas";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    portalKey: "",
    name: "",
    email: "",
    password: "",
    confirm: "",
    registrationNo: "",
    phone: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (form.password !== form.confirm) {
      setError("Passwords do not match");
      return;
    }
    const payload = { ...form, confirm: undefined };
    const parsed = registerSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your input");
      return;
    }

    setBusy(true);
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Registration failed");
      setBusy(false);
      return;
    }
    const login = await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
    setBusy(false);
    if (login?.error) {
      router.push("/login");
      return;
    }
    router.push("/student/dashboard");
    router.refresh();
  }

  return (
    <AuthLayout
      title="Create your scholar account"
      subtitle="Use the one-time portal key issued to you by the R&D section."
      image="shelves"
      footer={
        <>
          Already registered?{" "}
          <Link href="/login" className="link font-medium">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {error && (
          <p className="flash-error">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-danger" />
            {error}
          </p>
        )}
        <div>
          <label className="label" htmlFor="portalKey">
            Portal key
          </label>
          <input
            id="portalKey"
            required
            autoFocus
            placeholder="PHD-XXXX-XXXX-XXXX"
            className="input mono uppercase tracking-wider"
            value={form.portalKey}
            onChange={(e) => set("portalKey", e.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="name">
              Full name
            </label>
            <input id="name" required autoComplete="name" className="input" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="registrationNo">
              Registration no. <span className="font-normal text-muted">(optional)</span>
            </label>
            <input id="registrationNo" className="input" value={form.registrationNo} onChange={(e) => set("registrationNo", e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="email">
            Email address
          </label>
          <input id="email" type="email" required autoComplete="email" className="input" value={form.email} onChange={(e) => set("email", e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="phone">
            Phone <span className="font-normal text-muted">(optional)</span>
          </label>
          <input id="phone" autoComplete="tel" className="input" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input id="password" type="password" required autoComplete="new-password" className="input" value={form.password} onChange={(e) => set("password", e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="confirm">
              Confirm password
            </label>
            <input id="confirm" type="password" required autoComplete="new-password" className="input" value={form.confirm} onChange={(e) => set("confirm", e.target.value)} />
          </div>
        </div>
        <p className="hint">At least 10 characters, including a letter and a digit.</p>
        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthLayout>
  );
}
