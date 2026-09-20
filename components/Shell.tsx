"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarCheck,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Inbox,
  KeyRound,
  LayoutDashboard,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import UserMenu from "@/components/UserMenu";
import { APP_NAME, APP_TAGLINE, ORG_NAME } from "@/lib/site";

export type IconKey =
  | "dashboard"
  | "requests"
  | "approvals"
  | "meetings"
  | "students"
  | "staff"
  | "dc"
  | "keys"
  | "proposal";

const ICONS: Record<IconKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  requests: Inbox,
  approvals: ClipboardCheck,
  meetings: CalendarCheck,
  students: GraduationCap,
  staff: Users,
  dc: UsersRound,
  keys: KeyRound,
  proposal: FileText,
};

export type NavLink = { href: string; label: string; icon: IconKey; count?: number };

/**
 * Application frame: a GitHub-style header (brand, context, theme, user menu),
 * an underline tab bar for the role's sections, the page, and a footer.
 */
export default function Shell({
  links,
  userName,
  userEmail,
  roleLabel,
  home,
  children,
}: {
  links: NavLink[];
  userName: string;
  userEmail: string;
  roleLabel: string;
  home: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-header">
        <div className="mx-auto flex h-14 max-w-page items-center gap-3 px-4">
          <Link href={home} className="flex items-center gap-2.5" aria-label={`${APP_NAME} home`}>
            <Logo size={36} />
            <span className="display text-[17px] leading-none">{APP_NAME}</span>
          </Link>
          <span className="hidden text-faint sm:inline" aria-hidden>
            /
          </span>
          <span className="hidden text-sm font-medium text-fg sm:inline">{roleLabel}</span>
          <div className="flex-1" />
          <ThemeToggle />
          <UserMenu name={userName} email={userEmail} roleLabel={roleLabel} />
        </div>
        <nav className="mx-auto max-w-page px-4" aria-label="Sections">
          <div className="underline-nav">
            {links.map((l) => {
              const active = pathname === l.href || pathname.startsWith(l.href + "/");
              const Icon = ICONS[l.icon];
              return (
                <Link key={l.href} href={l.href} className="underline-nav-item" aria-current={active ? "page" : undefined}>
                  <Icon size={16} className={active ? "text-fg" : "text-muted"} />
                  {l.label}
                  {typeof l.count === "number" && l.count > 0 && <span className="counter">{l.count}</span>}
                </Link>
              );
            })}
          </div>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-page flex-1 px-4 py-6 animate-fade-in">{children}</main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-page flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs text-muted">
          <span className="flex items-center gap-2">
            <Logo size={22} />
            {APP_NAME} · {ORG_NAME}
          </span>
          <span>{APP_TAGLINE}</span>
        </div>
      </footer>
    </div>
  );
}
