import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import type { UserRole } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isUuid } from "@/lib/api";

export type SessionUser = {
  id: string;
  role: UserRole;
  mustChangePassword: boolean;
  name?: string | null;
  email?: string | null;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  return session?.user ?? null;
}

type AuthResult = { user: SessionUser; error?: never } | { user?: never; error: NextResponse };

/** Route-handler guard: verifies a session exists and the role matches. */
export async function requireRole(roles: UserRole | UserRole[]): Promise<AuthResult> {
  const user = await getSessionUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }
  const allowed = Array.isArray(roles) ? roles : [roles];
  if (!allowed.includes(user.role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  if (user.mustChangePassword) {
    return { error: NextResponse.json({ error: "Password change required" }, { status: 403 }) };
  }
  return { user };
}

export type StudentRelation = "OWNER" | "SUPERVISOR" | "CO_SUPERVISOR" | "ADMIN";

/**
 * What relationship does this user have to the given student profile?
 * Used to gate student pages and document access. Returns null for no access.
 * DC members are a separate no-login pool, so staff relate to a student only as
 * supervisor or co-supervisor.
 */
export async function relationToStudent(user: SessionUser, studentProfileId: string): Promise<StudentRelation | null> {
  if (!isUuid(studentProfileId)) return null;
  if (user.role === "RND_ADMIN") return "ADMIN";

  const student = await prisma.studentProfile.findUnique({
    where: { id: studentProfileId },
    select: { userId: true, supervisorId: true, coSupervisorId: true },
  });
  if (!student) return null;

  if (user.role === "STUDENT") {
    return student.userId === user.id ? "OWNER" : null;
  }

  // STAFF
  const staff = await prisma.staffProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!staff) return null;
  if (student.supervisorId === staff.id) return "SUPERVISOR";
  if (student.coSupervisorId === staff.id) return "CO_SUPERVISOR";
  return null;
}
