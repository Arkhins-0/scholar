"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { ChevronDown, KeyRound, LogOut } from "lucide-react";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export default function UserMenu({ name, email, roleLabel }: { name: string; email: string; roleLabel: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-8 items-center gap-2 border border-line bg-surface pl-1 pr-2 text-sm hover:bg-elevated"
      >
        <span className="flex h-6 w-6 items-center justify-center bg-fg text-[11px] font-bold text-bg">{initials(name)}</span>
        <span className="hidden max-w-[10rem] truncate font-medium sm:inline">{name}</span>
        <ChevronDown size={14} className="text-muted" />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-1 w-64 border border-line bg-surface shadow-menu animate-fade-in">
          <div className="border-b border-line px-3 py-2.5">
            <div className="truncate text-sm font-semibold">{name}</div>
            <div className="truncate text-xs text-muted">{email}</div>
            <div className="mt-1.5 inline-flex border border-line bg-elevated px-1.5 text-[11px] font-medium text-muted">{roleLabel}</div>
          </div>
          <div className="py-1">
            <Link
              href="/change-password"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-fg hover:bg-elevated"
            >
              <KeyRound size={15} className="text-muted" /> Change password
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-fg hover:bg-elevated"
            >
              <LogOut size={15} className="text-muted" /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
