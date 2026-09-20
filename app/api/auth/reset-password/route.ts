import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseBody } from "@/lib/api";
import { resetPasswordSchema } from "@/lib/schemas";
import { hashResetToken } from "@/lib/reset-tokens";
import { hashPassword } from "@/lib/passwords";
import { sendEmail } from "@/lib/email";
import { appUrl } from "@/lib/site";
import { audit } from "@/lib/audit";

/** Completes the forgot-password flow with a token from the emailed link. */
export async function POST(req: Request) {
  const body = await parseBody(req, resetPasswordSchema);
  if (body.error) return body.error;

  const token = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(body.data.token) },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
  if (!token || token.usedAt || token.expiresAt < new Date()) {
    return jsonError(400, "This reset link is invalid or has expired. Request a new one.");
  }

  const passwordHash = await hashPassword(body.data.password);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: token.userId },
      data: { passwordHash, mustChangePassword: false, failedLoginCount: 0, lockedUntil: null },
    }),
    // Consume this token and void any other outstanding links for the account.
    prisma.passwordResetToken.updateMany({
      where: { userId: token.userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
  ]);

  await audit({
    actorId: token.userId,
    action: "PASSWORD_RESET_COMPLETED",
    entityType: "User",
    entityId: token.userId,
  });

  await sendEmail({
    to: token.user.email,
    subject: "Your Scholar Track password was changed",
    heading: "Password changed",
    paragraphs: [
      `Hello ${token.user.name},`,
      "The password for your Scholar Track account was just changed using a reset link. You can sign in with the new password now.",
    ],
    cta: { label: "Sign in", url: appUrl("/login") },
    footnote: "If you did not make this change, contact the R&D section immediately.",
  });

  return NextResponse.json({ ok: true });
}
