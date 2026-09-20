import Shell from "@/components/Shell";
import { getSessionUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  const [requests, approvals, meetings] = await Promise.all([
    prisma.studentProfile.count({ where: { supervisorRequestStatus: "PENDING" } }),
    prisma.milestoneApplication.count({ where: { status: "SUPERVISOR_APPROVED" } }),
    prisma.milestoneApplication.count({ where: { status: "RND_APPROVED" } }),
  ]);

  return (
    <Shell
      roleLabel="R&D Section"
      home="/admin/dashboard"
      userName={user?.name ?? ""}
      userEmail={user?.email ?? ""}
      links={[
        { href: "/admin/dashboard", label: "Overview", icon: "dashboard" },
        { href: "/admin/supervisor-requests", label: "Supervisor requests", icon: "requests", count: requests },
        { href: "/admin/approvals", label: "Approvals", icon: "approvals", count: approvals },
        { href: "/admin/meetings", label: "Meetings", icon: "meetings", count: meetings },
        { href: "/admin/students", label: "Scholars", icon: "students" },
        { href: "/admin/staff", label: "Staff", icon: "staff" },
        { href: "/admin/dc-members", label: "DC members", icon: "dc" },
        { href: "/admin/portal-keys", label: "Portal keys", icon: "keys" },
      ]}
    >
      {children}
    </Shell>
  );
}
