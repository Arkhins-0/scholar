"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export default function SignOutButton({ className = "btn-default" }: { className?: string }) {
  return (
    <button type="button" onClick={() => signOut({ callbackUrl: "/login" })} title="Sign out" className={className}>
      <LogOut size={15} />
      <span>Sign out</span>
    </button>
  );
}
