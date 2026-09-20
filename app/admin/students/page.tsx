import { Download, GraduationCap, Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { STAGES } from "@/lib/milestones";
import { RESEARCH_DOMAINS } from "@/lib/domains";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";

export const dynamic = "force-dynamic";

type Search = { stage?: string; domain?: string; supervisor?: string; q?: string };

const REQUEST_LABELS: Record<string, string> = {
  NOT_REQUESTED: "Not requested",
  PENDING: "Pending",
  ALLOCATED: "Allocated",
};

export default async function AdminStudentsPage({ searchParams }: { searchParams: Search }) {
  const { stage, domain, supervisor, q } = searchParams;

  const where: Prisma.StudentProfileWhereInput = {
    ...(stage && (STAGES as readonly string[]).includes(stage) ? { currentMilestoneCode: stage } : {}),
    ...(domain && (RESEARCH_DOMAINS as readonly string[]).includes(domain) ? { domain } : {}),
    ...(supervisor ? { supervisorId: supervisor } : {}),
    ...(q
      ? {
          user: {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          },
        }
      : {}),
  };

  const [students, supervisors] = await Promise.all([
    prisma.studentProfile.findMany({
      where,
      include: {
        user: { select: { name: true, email: true } },
        supervisor: { include: { user: { select: { name: true } } } },
        coSupervisor: { include: { user: { select: { name: true } } } },
      },
      orderBy: { createdAt: "asc" },
      take: 500,
    }),
    prisma.staffProfile.findMany({
      where: { supervisingStudents: { some: {} } },
      include: { user: { select: { name: true } } },
      orderBy: { user: { name: "asc" } },
    }),
  ]);

  const filtered = !!(stage || domain || supervisor || q);

  return (
    <div>
      <PageHeader
        icon={GraduationCap}
        title="Scholars"
        subtitle={`${students.length} ${filtered ? "matching" : "registered"} scholar${students.length === 1 ? "" : "s"}`}
        actions={
          <a href="/api/admin/students/export" className="btn-default">
            <Download size={15} /> Export CSV
          </a>
        }
      />

      <div className="box">
        <form method="GET" className="box-header grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_2fr_1.5fr_auto] lg:items-end">
          <div>
            <label className="label text-xs" htmlFor="q">
              Search
            </label>
            <input id="q" name="q" defaultValue={q ?? ""} placeholder="Name or email" className="input bg-surface" />
          </div>
          <div>
            <label className="label text-xs" htmlFor="stage">
              Stage
            </label>
            <select id="stage" name="stage" defaultValue={stage ?? ""} className="input bg-surface">
              <option value="">All</option>
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label text-xs" htmlFor="domain">
              Domain
            </label>
            <select id="domain" name="domain" defaultValue={domain ?? ""} className="input bg-surface">
              <option value="">All domains</option>
              {RESEARCH_DOMAINS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label text-xs" htmlFor="supervisor">
              Supervisor
            </label>
            <select id="supervisor" name="supervisor" defaultValue={supervisor ?? ""} className="input bg-surface">
              <option value="">All supervisors</option>
              {supervisors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.user.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-default">
              <Search size={15} /> Filter
            </button>
            {filtered && (
              <a href="/admin/students" className="btn-invisible">
                Clear
              </a>
            )}
          </div>
        </form>

        {students.length === 0 ? (
          <EmptyState icon={GraduationCap} title="No scholars match" description={filtered ? "Try clearing a filter." : "Scholars appear here once they register with a portal key."} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="th">Scholar</th>
                  <th className="th">Domain</th>
                  <th className="th">Stage</th>
                  <th className="th">Supervisor</th>
                  <th className="th">Co-supervisor</th>
                  <th className="th">Request</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {students.map((s) => (
                  <tr key={s.id} className="hover:bg-elevated/60">
                    <td className="td">
                      <div className="font-medium">{s.user.name}</div>
                      <div className="text-xs text-muted">{s.user.email}</div>
                    </td>
                    <td className="td max-w-[16rem] truncate text-muted">{s.domain ?? "—"}</td>
                    <td className="td">
                      <StatusBadge status="STAGE" label={s.currentMilestoneCode} />
                    </td>
                    <td className="td">{s.supervisor?.user.name ?? <span className="text-faint">—</span>}</td>
                    <td className="td">{s.coSupervisor?.user.name ?? <span className="text-faint">—</span>}</td>
                    <td className="td">
                      <StatusBadge status={s.supervisorRequestStatus} label={REQUEST_LABELS[s.supervisorRequestStatus]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
