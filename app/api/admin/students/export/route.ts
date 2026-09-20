import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";

function csvEscape(v: string | null | undefined): string {
  const s = v ?? "";
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

/** CSV export of all students and their current stage. */
export async function GET() {
  const auth = await requireRole("RND_ADMIN");
  if (auth.error) return auth.error;

  const students = await prisma.studentProfile.findMany({
    include: {
      user: { select: { name: true, email: true } },
      supervisor: { include: { user: { select: { name: true } } } },
      coSupervisor: { include: { user: { select: { name: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });

  const header = "Name,Email,Registration No,Domain,Title,Stage,Supervisor,Co-Supervisor,Supervisor Request";
  const rows = students.map((s) =>
    [
      csvEscape(s.user.name),
      csvEscape(s.user.email),
      csvEscape(s.registrationNo),
      csvEscape(s.domain),
      csvEscape(s.title),
      csvEscape(s.currentMilestoneCode),
      csvEscape(s.supervisor?.user.name),
      csvEscape(s.coSupervisor?.user.name),
      csvEscape(s.supervisorRequestStatus),
    ].join(",")
  );

  return new Response([header, ...rows].join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="students-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
