import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/authz";

const ROLE_HOME: Record<string, string> = {
  STUDENT: "/student/dashboard",
  STAFF: "/staff/dashboard",
  RND_ADMIN: "/admin/dashboard",
};

export default async function Home() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");
  redirect(ROLE_HOME[user.role] ?? "/login");
}
