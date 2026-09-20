import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, UserCog, UsersRound } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/authz";
import PageHeader from "@/components/PageHeader";
import Alert from "@/components/Alert";
import StageTimeline, { type TimelineStage } from "@/components/StageTimeline";
import { MILESTONE_CODES, previousMilestone, type MilestoneCode } from "@/lib/milestones";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const REQUEST_LABELS: Record<string, string> = {
  NOT_REQUESTED: "Action needed",
  PENDING: "Awaiting allocation",
  ALLOCATED: "Supervisor allocated",
};

export default async function StudentDashboard() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: user.id },
    include: {
      user: { select: { name: true, email: true } },
      supervisor: { include: { user: { select: { name: true } } } },
      coSupervisor: { include: { user: { select: { name: true } } } },
      dcMembers: { include: { dcMember: true }, orderBy: { assignedAt: "asc" } },
      applications: { include: { milestone: true } },
    },
  });
  if (!profile) redirect("/login");

  const milestones = await prisma.milestone.findMany({ select: { code: true, name: true } });
  const nameByCode = new Map(milestones.map((m) => [m.code, m.name]));
  const appByCode = new Map(profile.applications.map((a) => [a.milestone.code, a]));
  const isDone = (code: string) => {
    const s = appByCode.get(code)?.status;
    return s === "MEETING_COMPLETED" || s === "DEGREE_ISSUED";
  };
  const isUnlocked = (code: MilestoneCode) => {
    if (!profile.supervisorId) return false;
    const prev = previousMilestone(code);
    return !prev || isDone(prev);
  };

  const stages: TimelineStage[] = [
    {
      code: "PROPOSAL",
      label: "Proposal & supervisor",
      status: profile.supervisorRequestStatus,
      statusLabel: REQUEST_LABELS[profile.supervisorRequestStatus],
      href: "/student/proposal",
      done: profile.supervisorRequestStatus === "ALLOCATED",
    },
    ...MILESTONE_CODES.map((code): TimelineStage => {
      const app = appByCode.get(code);
      const unlocked = isUnlocked(code);
      return {
        code,
        label: app?.milestone.name ?? nameByCode.get(code) ?? code,
        status: app?.status ?? (unlocked ? "OPEN" : "LOCKED"),
        statusLabel: app ? undefined : unlocked ? "Open" : "Locked",
        href: unlocked ? `/student/milestones/${code}` : undefined,
        done: isDone(code),
      };
    }),
  ];

  // What should the student do next?
  let action: { text: string; href?: string } | null = null;
  const proposalComplete = !!(profile.title && profile.domain && profile.proposalStorageKey);
  if (!proposalComplete) {
    action = { text: "Complete your research proposal: title, domain and the proposed-work PDF.", href: "/student/proposal" };
  } else if (profile.supervisorRequestStatus === "NOT_REQUESTED") {
    action = { text: "Your proposal is ready. Request supervisor allocation.", href: "/student/proposal" };
  } else if (profile.supervisorRequestStatus === "PENDING") {
    action = { text: "Waiting for the R&D section to allocate your supervisor." };
  } else if (profile.currentMilestoneCode === "COMPLETED") {
    action = null;
  } else {
    for (const code of MILESTONE_CODES) {
      if (isDone(code)) continue;
      const app = appByCode.get(code);
      const href = `/student/milestones/${code}`;
      if (!app) action = { text: `Start your ${code} application.`, href };
      else if (app.status === "DRAFT") action = { text: `Upload the required documents and submit your ${code} application.`, href };
      else if (app.status === "SUPERVISOR_REJECTED" || app.status === "RND_REJECTED")
        action = { text: `Your ${code} application was returned with remarks. Revise and resubmit.`, href };
      else if (app.status === "SUBMITTED") action = { text: `Your ${code} application is awaiting supervisor review.`, href };
      else if (app.status === "SUPERVISOR_APPROVED") action = { text: `Your ${code} application is awaiting R&D review.`, href };
      else if (app.status === "RND_APPROVED")
        action = {
          text:
            code === "DEGREE"
              ? "R&D has approved your degree application. Awaiting degree issuance."
              : `You are cleared for the ${code} meeting. R&D will mark it completed afterwards.`,
          href,
        };
      break;
    }
  }

  const degreeApp = appByCode.get("DEGREE");
  const completed = degreeApp?.status === "DEGREE_ISSUED";

  return (
    <div>
      <PageHeader
        title={profile.user.name}
        subtitle={
          <>
            {profile.user.email}
            {profile.registrationNo ? ` · ${profile.registrationNo}` : ""}
            {profile.domain ? ` · ${profile.domain}` : ""}
          </>
        }
        actions={
          <span className="chip h-7 px-2 text-sm">
            Stage <span className="mono font-semibold text-fg">{profile.currentMilestoneCode}</span>
          </span>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          {completed && (
            <Alert tone="success" title="Degree completed">
              Your degree was issued on <strong className="text-fg">{fmtDate(degreeApp?.degreeIssuedAt)}</strong>. Congratulations, Doctor.
            </Alert>
          )}

          {action && (
            <Alert
              tone={action.href ? "warn" : "info"}
              title="Next step"
              actions={
                action.href && (
                  <Link href={action.href} className="btn-default btn-sm">
                    Go there <ArrowRight size={13} />
                  </Link>
                )
              }
            >
              {action.text}
            </Alert>
          )}

          <StageTimeline stages={stages} />
        </div>

        <aside className="space-y-6">
          <div className="box">
            <div className="box-header">
              <h2 className="box-title flex items-center gap-2">
                <UserCog size={15} className="text-muted" /> Supervision
              </h2>
            </div>
            <dl className="text-sm">
              <div className="box-row flex items-center justify-between gap-4">
                <dt className="text-muted">Supervisor</dt>
                <dd className="text-right font-medium">{profile.supervisor?.user.name ?? <span className="text-faint">Not allocated</span>}</dd>
              </div>
              <div className="box-row flex items-center justify-between gap-4">
                <dt className="text-muted">Co-supervisor</dt>
                <dd className="text-right font-medium">{profile.coSupervisor?.user.name ?? <span className="text-faint">—</span>}</dd>
              </div>
            </dl>
          </div>

          <div className="box">
            <div className="box-header">
              <h2 className="box-title flex items-center gap-2">
                <UsersRound size={15} className="text-muted" /> Doctoral Committee
              </h2>
              {profile.dcMembers.length > 0 && <span className="counter">{profile.dcMembers.length}</span>}
            </div>
            {profile.dcMembers.length === 0 ? (
              <p className="px-4 py-3 text-sm text-faint">Not constituted yet. Your supervisor selects the members.</p>
            ) : (
              <ul className="text-sm">
                {profile.dcMembers.map((m) => (
                  <li key={m.id} className="box-row">
                    <div className="font-medium">{m.dcMember.name}</div>
                    {(m.dcMember.designation || m.dcMember.affiliation || m.dcMember.department) && (
                      <div className="text-xs text-muted">
                        {[m.dcMember.designation, m.dcMember.affiliation ?? m.dcMember.department].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {profile.title && (
            <div className="box">
              <div className="box-header">
                <h2 className="box-title">Research</h2>
              </div>
              <div className="box-body text-sm">
                <p className="display text-base leading-snug">{profile.title}</p>
                <p className="mt-1 text-xs text-muted">{profile.domain}</p>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
