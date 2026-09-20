import Shell from "@/components/Shell";
import { getSessionUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  const awaiting = user
    ? await prisma.milestoneApplication.count({
        where: { status: "SUBMITTED", student: { supervisor: { userId: user.id } } },
      })
    : 0;

  return (
    <Shell
      roleLabel="Supervisor"
      home="/staff/dashboard"
      userName={user?.name ?? ""}
      userEmail={user?.email ?? ""}
      links={[{ href: "/staff/dashboard", label: "My scholars", icon: "students", count: awaiting }]}
    >
      {children}
    </Shell>
  );
}
