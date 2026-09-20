import { UsersRound } from "lucide-react";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import DcMemberManager from "@/components/DcMemberManager";

export const dynamic = "force-dynamic";

export default async function AdminDcMembersPage() {
  const members = await prisma.dcMember.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: { _count: { select: { memberships: true } } },
  });

  return (
    <div>
      <PageHeader
        icon={UsersRound}
        title="DC members"
        subtitle="The Doctoral Committee pool. Supervisors assign these members to their scholars."
      />
      <DcMemberManager
        members={members.map((m) => ({
          id: m.id,
          name: m.name,
          email: m.email ?? "",
          department: m.department ?? "",
          designation: m.designation ?? "",
          affiliation: m.affiliation ?? "",
          isActive: m.isActive,
          assignments: m._count.memberships,
        }))}
      />
    </div>
  );
}
