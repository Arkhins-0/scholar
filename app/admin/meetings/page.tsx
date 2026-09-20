import { CalendarCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { fmtDateTime } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import ActionButton from "@/components/ActionButton";
import EmptyState from "@/components/EmptyState";

export const dynamic = "force-dynamic";

export default async function AdminMeetingsPage() {
  const applications = await prisma.milestoneApplication.findMany({
    where: { status: "RND_APPROVED" },
    include: {
      milestone: true,
      student: { include: { user: { select: { name: true, email: true } } } },
    },
    orderBy: { rndReviewedAt: "asc" },
  });

  return (
    <div>
      <PageHeader
        icon={CalendarCheck}
        title="Meetings & degrees"
        subtitle="Record held DC meetings as completed to unlock the next stage. On the Degree stage this issues the degree."
        actions={<span className="counter h-7 px-2 text-sm">{applications.length} cleared</span>}
      />

      <div className="box">
        {applications.length === 0 ? (
          <EmptyState icon={CalendarCheck} title="No cleared applications" description="Applications approved by R&D appear here until their meeting is recorded." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="th">Scholar</th>
                  <th className="th">Milestone</th>
                  <th className="th">R&amp;D approved</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {applications.map((app) => {
                  const isDegree = app.milestone.code === "DEGREE";
                  return (
                    <tr key={app.id}>
                      <td className="td">
                        <div className="font-medium">{app.student.user.name}</div>
                        <div className="text-xs text-muted">{app.student.user.email}</div>
                      </td>
                      <td className="td">
                        <span className="mono mr-1.5 text-xs uppercase text-faint">{app.milestone.code}</span>
                        {app.milestone.name}
                      </td>
                      <td className="td text-muted">{fmtDateTime(app.rndReviewedAt)}</td>
                      <td className="td text-right">
                        <ActionButton
                          url={`/api/applications/${app.id}/complete`}
                          label={isDegree ? "Issue degree" : "Mark meeting completed"}
                          busyLabel="Saving…"
                          variant="success"
                          size="sm"
                          confirmText={
                            isDegree
                              ? `Issue the degree for ${app.student.user.name}? This completes their PhD journey.`
                              : `Mark the ${app.milestone.code} meeting for ${app.student.user.name} as completed? This unlocks the next stage.`
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
