import Link from "next/link";
import { ArrowUpRight, CalendarCheck, ClipboardCheck, Inbox, KeyRound, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { STAGES } from "@/lib/milestones";
import { fmtDateTime } from "@/lib/format";
import PageHeader from "@/components/PageHeader";

export const dynamic = "force-dynamic";

const ACTION_LABELS: Record<string, string> = {
  STUDENT_REGISTERED: "Scholar registered",
  SUPERVISOR_REQUESTED: "Supervisor requested",
  SUPERVISOR_ALLOCATED: "Supervisor allocated",
  APPLICATION_SUBMITTED: "Application submitted",
  APPLICATION_RESUBMITTED: "Application resubmitted",
  SUPERVISOR_APPROVED: "Approved by supervisor",
  SUPERVISOR_REJECTED: "Returned by supervisor",
  RND_APPROVED: "Approved by R&D",
  RND_REJECTED: "Returned by R&D",
  MEETING_COMPLETED: "Meeting completed",
  DEGREE_ISSUED: "Degree issued",
  STAFF_CREATED: "Staff account created",
  PORTAL_KEYS_GENERATED: "Portal keys generated",
  DC_COMMITTEE_SET: "Committee constituted",
};

export default async function AdminDashboard() {
  const [byStage, pendingRequests, awaitingSupervisor, awaitingRnd, awaitingMeeting, totalStudents, unusedKeys, recent] =
    await Promise.all([
      prisma.studentProfile.groupBy({ by: ["currentMilestoneCode"], _count: { _all: true } }),
      prisma.studentProfile.count({ where: { supervisorRequestStatus: "PENDING" } }),
      prisma.milestoneApplication.count({ where: { status: "SUBMITTED" } }),
      prisma.milestoneApplication.count({ where: { status: "SUPERVISOR_APPROVED" } }),
      prisma.milestoneApplication.count({ where: { status: "RND_APPROVED" } }),
      prisma.studentProfile.count(),
      prisma.portalKey.count({ where: { isUsed: false } }),
      prisma.auditLog.findMany({
        where: { action: { in: Object.keys(ACTION_LABELS) } },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
    ]);

  const stageCounts = new Map(byStage.map((g) => [g.currentMilestoneCode, g._count._all]));
  const maxStage = Math.max(1, ...STAGES.map((s) => stageCounts.get(s) ?? 0));

  const queues: { label: string; count: number; href: string; desc: string; icon: LucideIcon }[] = [
    { label: "Supervisor requests", count: pendingRequests, href: "/admin/supervisor-requests", desc: "scholars awaiting a supervisor", icon: Inbox },
    { label: "R&D approvals", count: awaitingRnd, href: "/admin/approvals", desc: "approved by supervisors", icon: ClipboardCheck },
    { label: "Meetings & degrees", count: awaitingMeeting, href: "/admin/meetings", desc: "cleared, awaiting completion", icon: CalendarCheck },
    { label: "With supervisors", count: awaitingSupervisor, href: "/admin/students", desc: "in supervisor review", icon: Users },
  ];

  return (
    <div>
      <PageHeader
        title="Overview"
        subtitle={`${totalStudents} scholar${totalStudents === 1 ? "" : "s"} registered · ${unusedKeys} unused portal key${unusedKeys === 1 ? "" : "s"}`}
        actions={
          <Link href="/admin/portal-keys" className="btn-default">
            <KeyRound size={15} /> Portal keys
          </Link>
        }
      />

      <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {queues.map((q) => (
          <Link key={q.href + q.label} href={q.href} className="stat-tile group">
            <div>
              <div className={`display text-3xl tabular-nums ${q.count > 0 ? "" : "text-muted"}`}>{q.count}</div>
              <div className="mt-1 text-sm font-semibold">{q.label}</div>
              <div className="text-xs text-muted">{q.desc}</div>
            </div>
            <span className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${q.count > 0 ? "bg-attention/15 text-attention" : "bg-accent/10 text-accent"}`}>
              <q.icon size={16} />
            </span>
          </Link>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className="box">
          <div className="box-header">
            <h2 className="box-title">Scholars by stage</h2>
            <Link href="/admin/students" className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
              View all <ArrowUpRight size={13} />
            </Link>
          </div>
          <ul className="box-body space-y-2.5">
            {STAGES.map((stage) => {
              const n = stageCounts.get(stage) ?? 0;
              return (
                <li key={stage} className="grid grid-cols-[6rem_1fr_2.5rem] items-center gap-3 text-sm">
                  <Link href={`/admin/students?stage=${stage}`} className="mono text-xs text-muted hover:text-accent hover:underline">
                    {stage}
                  </Link>
                  <span className="h-3 overflow-hidden rounded-full bg-elevated">
                    <span className="block h-full rounded-full bg-accent" style={{ width: `${(n / maxStage) * 100}%` }} />
                  </span>
                  <span className="text-right tabular-nums">{n}</span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="box">
          <div className="box-header">
            <h2 className="box-title">Recent activity</h2>
          </div>
          {recent.length === 0 ? (
            <p className="px-4 py-3 text-sm text-faint">No activity yet.</p>
          ) : (
            <ul>
              {recent.map((r) => (
                <li key={r.id} className="box-row flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">{ACTION_LABELS[r.action] ?? r.action}</span>
                  <span className="shrink-0 text-xs text-muted">{fmtDateTime(r.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
