import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/authz";
import { jsonError, parseBody } from "@/lib/api";
import { changePasswordSchema } from "@/lib/schemas";
import { hashPassword, verifyPassword } from "@/lib/passwords";
import { audit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { appUrl } from "@/lib/site";

export async function POST(req: Request) {
  // Deliberately not requireRole(): users flagged mustChangePassword land here first.
  const user = await getSessionUser();
  if (!user) return jsonError(401, "Not authenticated");

  const body = await parseBody(req, changePasswordSchema);
  if (body.error) return body.error;

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser) return jsonError(401, "Not authenticated");

  const ok = await verifyPassword(body.data.currentPassword, dbUser.passwordHash);
  if (!ok) return jsonError(400, "Current password is incorrect");

  await prisma.user.update({
    where: { id: dbUser.id },
    data: {
      passwordHash: await hashPassword(body.data.newPassword),
      mustChangePassword: false,
      failedLoginCount: 0,
      lockedUntil: null,
    },
  });

  await audit({ actorId: dbUser.id, action: "PASSWORD_CHANGED", entityType: "User", entityId: dbUser.id });

  await sendEmail({
    to: dbUser.email,
    subject: "Your Scholar Track password was changed",
    heading: "Password changed",
    paragraphs: [
      `Hello ${dbUser.name},`,
      "The password for your Scholar Track account was just changed. You will need the new password the next time you sign in.",
    ],
    cta: { label: "Sign in", url: appUrl("/login") },
    footnote: "If you did not make this change, contact the R&D section immediately.",
  });

  // Client signs out after this; the fresh login issues a token without the flag.
  return NextResponse.json({ ok: true });
}
