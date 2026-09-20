import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarClock, FileText, Mail, Paperclip, UserCog, UsersRound } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSessionUser, relationToStudent } from "@/lib/authz";
import { DOC_TYPE_LABELS } from "@/lib/milestones";
import { fmtDateTime } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";
import CommitteeForm from "@/components/CommitteeForm";
import ReviewForm from "@/components/ReviewForm";

export const dynamic = "force-dynamic";

export default async function StaffStudentPage({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const relation = await relationToStudent(user, params.id);
  if (relation !== "SUPERVISOR" && relation !== "CO_SUPERVISOR") {
    redirect("/staff/dashboard");
  }
  const isSupervisor = relation === "SUPERVISOR";

  const student = await prisma.studentProfile.findUnique({
    where: { id: params.id },
    include: {
      user: { select: { name: true, email: true, phone: true } },
      coSupervisor: { include: { user: { select: { name: true } } } },
      dcMembers: { include: { dcMember: true }, orderBy: { assignedAt: "asc" } },
      applications: {
        include: { milestone: true, documents: { orderBy: { uploadedAt: "asc" } } },
      },
    },
  });
  if (!student) notFound();

  const applications = [...student.applications].sort((a, b) => a.milestone.sequence - b.milestone.sequence);

  const [dcPool, staffPool] = isSupervisor
    ? await Promise.all([
        prisma.dcMember.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
        prisma.staffProfile.findMany({
          where: { id: { not: student.supervisorId ?? undefined } },
          include: { user: { select: { name: true } } },
          orderBy: { user: { name: "asc" } },
        }),
      ])
    : [[], []];

  return (
    <div>
      <Link href="/staff/dashboard" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft size={14} /> My scholars
      </Link>

      <div className="pagehead">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-fg text-lg font-bold text-bg">
            {student.user.name.trim().charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <h1 className="display text-2xl leading-tight">{student.user.name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              <span className="inline-flex items-center gap-1">
                <Mail size={13} /> {student.user.email}
              </span>
              {student.registrationNo && <span>{student.registrationNo}</span>}
              {!isSupervisor && <span className="chip">Co-supervisor · read-only</span>}
            </p>
          </div>
        </div>
        <StatusBadge status="STAGE" label={`Stage ${student.currentMilestoneCode}`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <section className="box">
            <div className="box-header">
              <h2 className="box-title flex items-center gap-2">
                <UsersRound size={15} className="text-muted" /> Doctoral Committee &amp; co-supervisor
              </h2>
            </div>
            <div className="box-body">
              {isSupervisor ? (
                <CommitteeForm
                  studentId={student.id}
                  currentCoSupervisorId={student.coSupervisorId}
                  currentDcIds={student.dcMembers.map((m) => m.dcMemberId)}
                  dcPool={(dcPool as { id: string; name: string; designation: string | null; affiliation: string | null; department: string | null }[]).map((m) => ({
                    id: m.id,
                    name: m.name,
                    detail: [m.designation, m.affiliation ?? m.department].filter(Boolean).join(", "),
                  }))}
                  staffPool={(staffPool as { id: string; designation: string | null; department: string | null; user: { name: string } }[]).map((s) => ({
                    id: s.id,
                    name: s.user.name,
                    detail: [s.designation, s.department].filter(Boolean).join(", "),
                  }))}
                />
              ) : (
                <dl className="grid gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="mb-1 flex items-center gap-1.5 text-xs text-muted">
                      <UsersRound size={13} /> DC members
                    </dt>
                    <dd className="font-medium">
                      {student.dcMembers.length > 0 ? student.dcMembers.map((m) => m.dcMember.name).join(", ") : "Not constituted"}
                    </dd>
                  </div>
                  <div>
                    <dt className="mb-1 flex items-center gap-1.5 text-xs text-muted">
                      <UserCog size={13} /> Co-supervisor
                    </dt>
                    <dd className="font-medium">{student.coSupervisor?.user.name ?? "—"}</dd>
                  </div>
                </dl>
              )}
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="section-title">Milestone applications</h2>
            {applications.length === 0 && <div className="box px-4 py-3 text-sm text-faint">No applications yet.</div>}
            {applications.map((app) => (
              <div key={app.id} className="box">
                <div className="box-header">
                  <h3 className="box-title">
                    <span className="mono mr-2 text-xs uppercase text-faint">{app.milestone.code}</span>
                    {app.milestone.name}
                  </h3>
                  <StatusBadge status={app.status} />
                </div>

                <div className="box-row flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock size={12} /> Submitted {fmtDateTime(app.submittedAt)}
                  </span>
                  <span>Supervisor {fmtDateTime(app.supervisorReviewedAt)}</span>
                  <span>R&amp;D {fmtDateTime(app.rndReviewedAt)}</span>
                </div>

                <div className="box-row">
                  <h4 className="section-title mb-2">Documents</h4>
                  {app.documents.length === 0 ? (
                    <p className="text-sm text-faint">None uploaded.</p>
                  ) : (
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {app.documents.map((d) => (
                        <li key={d.id}>
                          <a
                            href={`/api/documents/${d.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 border border-line bg-elevated px-3 py-2 text-sm transition-colors hover:border-accent"
                          >
                            <Paperclip size={14} className="shrink-0 text-faint" />
                            <span className="min-w-0 truncate">
                              <span className="font-medium">{DOC_TYPE_LABELS[d.docType] ?? d.docType}</span>
                              <span className="text-muted"> · {d.fileName}</span>
                            </span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {(app.supervisorRemarks || app.rndRemarks) && (
                  <div className="box-row space-y-2 text-sm">
                    {app.supervisorRemarks && (
                      <p>
                        <span className="font-semibold">Supervisor remarks: </span>
                        <span className="whitespace-pre-wrap">{app.supervisorRemarks}</span>
                      </p>
                    )}
                    {app.rndRemarks && (
                      <p>
                        <span className="font-semibold">R&amp;D remarks: </span>
                        <span className="whitespace-pre-wrap">{app.rndRemarks}</span>
                      </p>
                    )}
                  </div>
                )}

                {isSupervisor && app.status === "SUBMITTED" && (
                  <div className="box-row">
                    <h4 className="section-title mb-2">Your review</h4>
                    <ReviewForm url={`/api/applications/${app.id}/supervisor-review`} />
                  </div>
                )}
              </div>
            ))}
          </section>
        </div>

        <aside>
          <section className="box">
            <div className="box-header">
              <h2 className="box-title flex items-center gap-2">
                <FileText size={15} className="text-muted" /> Research proposal
              </h2>
            </div>
            {student.title ? (
              <dl className="text-sm">
                <div className="box-row">
                  <dt className="text-xs text-muted">Title</dt>
                  <dd className="display mt-0.5 text-base leading-snug">{student.title}</dd>
                </div>
                <div className="box-row">
                  <dt className="text-xs text-muted">Domain</dt>
                  <dd className="font-medium">{student.domain}</dd>
                </div>
                <div className="box-row">
                  <dt className="text-xs text-muted">Proposed work</dt>
                  <dd>
                    {student.proposalStorageKey ? (
                      <a
                        href={`/api/students/${student.id}/proposal-document`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 font-medium text-accent hover:underline"
                      >
                        <Paperclip size={14} />
                        {student.proposalFileName ?? "Proposal document"}
                      </a>
                    ) : (
                      <span className="text-faint">Not uploaded yet</span>
                    )}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="px-4 py-3 text-sm text-faint">The scholar has not submitted a proposal yet.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
