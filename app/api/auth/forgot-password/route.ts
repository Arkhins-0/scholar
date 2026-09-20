import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/api";
import { forgotPasswordSchema } from "@/lib/schemas";
import {
  generateResetToken,
  RESET_MAX_PER_WINDOW,
  RESET_RATE_WINDOW_MS,
  RESET_TOKEN_TTL_MS,
} from "@/lib/reset-tokens";
import { sendEmail } from "@/lib/email";
import { appUrl } from "@/lib/site";
import { audit } from "@/lib/audit";

/**
 * Starts the forgot-password flow. Always answers 200 so the endpoint cannot be
 * used to discover which emails have accounts. Per-account rate limit: at most
 * RESET_MAX_PER_WINDOW links per RESET_RATE_WINDOW_MS.
 */
export async function POST(req: Request) {
  const body = await parseBody(req, forgotPasswordSchema);
  if (body.error) return body.error;
  const { email } = body.data;

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, email: true } });
  if (user) {
    const recent = await prisma.passwordResetToken.count({
      where: { userId: user.id, createdAt: { gt: new Date(Date.now() - RESET_RATE_WINDOW_MS) } },
    });
    if (recent < RESET_MAX_PER_WINDOW) {
      const { raw, hash } = generateResetToken();
      await prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash: hash, expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
      });
      await audit({ actorId: user.id, action: "PASSWORD_RESET_REQUESTED", entityType: "User", entityId: user.id });

      await sendEmail({
        to: user.email,
        subject: "Reset your Scholar Track password",
        heading: "Reset your password",
        paragraphs: [
          `Hello ${user.name},`,
          "We received a request to reset the password for your Scholar Track account. Use the button below to choose a new one. The link is valid for 1 hour and can be used once.",
        ],
        cta: { label: "Choose a new password", url: appUrl(`/reset-password?token=${encodeURIComponent(raw)}`) },
        footnote: "If you did not request this, you can ignore this email. Your password will stay the same.",
      });
    }
  }

  return NextResponse.json({ ok: true });
}
