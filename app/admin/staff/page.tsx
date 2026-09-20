import { Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import StaffManager from "@/components/StaffManager";

export const dynamic = "force-dynamic";

export default async function AdminStaffPage() {
  const staff = await prisma.staffProfile.findMany({
    include: {
      user: { select: { name: true, email: true, phone: true } },
      _count: { select: { supervisingStudents: true, coSupervisingStudents: true } },
    },
    orderBy: { user: { name: "asc" } },
  });

  return (
    <div>
      <PageHeader
        icon={Users}
        title="Staff pool"
        subtitle="Supervisors and co-supervisors. The same person can hold both roles for different scholars."
      />
      <StaffManager
        staff={staff.map((s) => ({
          id: s.id,
          name: s.user.name,
          email: s.user.email,
          phone: s.user.phone ?? "",
          department: s.department ?? "",
          designation: s.designation ?? "",
          supervising: s._count.supervisingStudents,
          coSupervising: s._count.coSupervisingStudents,
        }))}
      />
    </div>
  );
}
