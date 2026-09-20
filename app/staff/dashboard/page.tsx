import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, ClipboardList, GraduationCap, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/authz";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";

export const dynamic = "force-dynamic";

export default async function StaffDashboard() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const staff = await prisma.staffProfile.findUnique({
    where: { userId: user.id },
    include: {
      supervisingStudents: {
        include: {
          user: { select: { name: true, email: true } },
          applications: { where: { status: "SUBMITTED" }, select: { id: true } },
          dcMembers: { select: { id: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      coSupervisingStudents: {
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!staff) redirect("/login");

  const pendingTotal = staff.supervisingStudents.reduce((n, s) => n + s.applications.length, 0);

  const tiles = [
    { label: "Supervising", value: staff.supervisingStudents.length, icon: GraduationCap },
    { label: "Co-supervising", value: staff.coSupervisingStudents.length, icon: Users },
    { label: "Awaiting your review", value: pendingTotal, icon: ClipboardList, highlight: pendingTotal > 0 },
  ];

  return (
    <div>
      <PageHeader
        title={user.name ?? "Supervisor"}
        subtitle={
          pendingTotal > 0
            ? `${pendingTotal} application${pendingTotal === 1 ? "" : "s"} awaiting your review.`
            : "You are all caught up. No applications are awaiting review."
        }
      />

      <section className="mb-6 grid gap-4 sm:grid-cols-3">
        {tiles.map((t) => (
          <div key={t.label} className="stat-tile">
            <div>
              <div className={`display text-3xl tabular-nums ${t.highlight ? "text-attention" : ""}`}>{t.value}</div>
              <div className="mt-1 text-sm text-muted">{t.label}</div>
            </div>
            <span className="flex h-8 w-8 items-center justify-center border border-line bg-elevated text-muted">
              <t.icon size={16} />
            </span>
          </div>
        ))}
      </section>

      <section className="box mb-6">
        <div className="box-header">
          <h2 className="box-title">Scholars you supervise</h2>
          <span className="counter">{staff.supervisingStudents.length}</span>
        </div>
        {staff.supervisingStudents.length === 0 ? (
          <EmptyState icon={GraduationCap} title="No scholars allocated yet" description="The R&D section allocates scholars to supervisors." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="th">Scholar</th>
                  <th className="th">Stage</th>
                  <th className="th">Committee</th>
                  <th className="th">Pending review</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {staff.supervisingStudents.map((s) => (
                  <tr key={s.id} className="hover:bg-elevated/60">
                    <td className="td">
                      <Link href={`/staff/students/${s.id}`} className="font-medium hover:text-accent hover:underline">
                        {s.user.name}
                      </Link>
                      <div className="text-xs text-muted">{s.user.email}</div>
                    </td>
                    <td className="td">
                      <StatusBadge status="STAGE" label={s.currentMilestoneCode} />
                    </td>
                    <td className="td">
                      {s.dcMembers.length > 0 ? (
                        <span className="chip">{s.dcMembers.length} members</span>
                      ) : (
                        <span className="chip border-attention/40 text-attention">Not constituted</span>
                      )}
                    </td>
                    <td className="td">
                      {s.applications.length > 0 ? (
                        <span className="chip border-attention/40 text-attention">{s.applications.length} waiting</span>
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </td>
                    <td className="td text-right">
                      <Link href={`/staff/students/${s.id}`} className="btn-default btn-sm">
                        Open <ChevronRight size={13} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="box">
        <div className="box-header">
          <h2 className="box-title">Scholars you co-supervise</h2>
          <span className="counter">{staff.coSupervisingStudents.length}</span>
        </div>
        {staff.coSupervisingStudents.length === 0 ? (
          <p className="px-4 py-3 text-sm text-faint">None.</p>
        ) : (
          <ul>
            {staff.coSupervisingStudents.map((s) => (
              <li key={s.id} className="box-row flex items-center justify-between gap-4 text-sm">
                <Link href={`/staff/students/${s.id}`} className="font-medium hover:text-accent hover:underline">
                  {s.user.name}
                </Link>
                <span className="flex items-center gap-3">
                  <StatusBadge status="STAGE" label={s.currentMilestoneCode} />
                  <Link href={`/staff/students/${s.id}`} className="btn-default btn-sm">
                    View <ChevronRight size={13} />
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
