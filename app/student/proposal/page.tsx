import { redirect } from "next/navigation";
import { FileText, UserCog } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/authz";
import PageHeader from "@/components/PageHeader";
import ProposalForm from "@/components/ProposalForm";
import ActionButton from "@/components/ActionButton";
import StatusBadge from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function ProposalPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: user.id },
    include: { supervisor: { include: { user: { select: { name: true } } } } },
  });
  if (!profile) redirect("/login");

  const locked = profile.supervisorRequestStatus === "ALLOCATED";
  const proposalComplete = !!(profile.title && profile.domain && profile.proposalStorageKey);

  const checklist = [
    { label: "Research title", ok: !!profile.title },
    { label: "Research domain", ok: !!profile.domain },
    { label: "Proposed-work PDF", ok: !!profile.proposalStorageKey },
  ];

  return (
    <div>
      <PageHeader
        icon={FileText}
        title="Research proposal"
        subtitle="Set your title and domain, upload the proposed-work PDF, then request a supervisor."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <ProposalForm
          profileId={profile.id}
          initial={{ title: profile.title ?? "", domain: profile.domain ?? "" }}
          proposalFileName={profile.proposalFileName}
          locked={locked}
        />

        <aside className="space-y-6">
          <div className="box">
            <div className="box-header">
              <h2 className="box-title flex items-center gap-2">
                <UserCog size={15} className="text-muted" /> Supervisor allocation
              </h2>
            </div>
            <div className="box-body space-y-3 text-sm">
              <StatusBadge
                status={profile.supervisorRequestStatus}
                label={
                  profile.supervisorRequestStatus === "ALLOCATED"
                    ? `Allocated: ${profile.supervisor?.user.name ?? ""}`
                    : profile.supervisorRequestStatus === "PENDING"
                      ? "Request pending with R&D"
                      : "Not requested yet"
                }
              />
              {profile.supervisorRequestStatus === "NOT_REQUESTED" && (
                <>
                  <ul className="divide-y divide-line border border-line">
                    {checklist.map((c) => (
                      <li key={c.label} className="flex items-center justify-between px-3 py-2">
                        <span className={c.ok ? "" : "text-muted"}>{c.label}</span>
                        <span className={`chip ${c.ok ? "border-success/40 text-success" : ""}`}>{c.ok ? "Done" : "Missing"}</span>
                      </li>
                    ))}
                  </ul>
                  <ActionButton
                    url="/api/proposal/request-supervisor"
                    label="Request supervisor allocation"
                    busyLabel="Requesting…"
                    confirmText={
                      proposalComplete
                        ? "Submit your proposal for supervisor allocation? The R&D section will review it."
                        : undefined
                    }
                  />
                  {!proposalComplete && (
                    <p className="text-xs text-muted">Complete the three items above before requesting a supervisor.</p>
                  )}
                </>
              )}
              {profile.supervisorRequestStatus === "PENDING" && (
                <p className="text-muted">The R&amp;D section has your proposal and will allocate a supervisor from the staff pool.</p>
              )}
              {locked && <p className="text-muted">Your DC1 stage is open on the overview page.</p>}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
