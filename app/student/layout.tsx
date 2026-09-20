import Shell from "@/components/Shell";
import { getSessionUser } from "@/lib/authz";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  return (
    <Shell
      roleLabel="Scholar"
      home="/student/dashboard"
      userName={user?.name ?? ""}
      userEmail={user?.email ?? ""}
      links={[
        { href: "/student/dashboard", label: "Overview", icon: "dashboard" },
        { href: "/student/proposal", label: "Proposal", icon: "proposal" },
      ]}
    >
      {children}
    </Shell>
  );
}
