import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { jsonError, requireUuidParam } from "@/lib/api";
import { generateTempPassword, hashPassword } from "@/lib/passwords";
import { audit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { appUrl } from "@/lib/site";

/** Issue a new temporary password for a staff member (shown once). */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole("RND_ADMIN");
  if (auth.error) return auth.error;

  const bad = requireUuidParam(params.id);
  if (bad) return bad;

  const staff = await prisma.staffProfile.findUnique({
    where: { id: params.id },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
  if (!staff) return jsonError(404, "Staff member not found");

  const tempPassword = generateTempPassword();
  await prisma.user.update({
    where: { id: staff.user.id },
    data: {
      passwordHash: await hashPassword(tempPassword),
      mustChangePassword: true,
      failedLoginCount: 0,
      lockedUntil: null,
    },
  });

  await audit({
    actorId: auth.user.id,
    action: "STAFF_PASSWORD_RESET",
    entityType: "StaffProfile",
    entityId: staff.id,
  });

  await sendEmail({
    to: staff.user.email,
    subject: "Your Scholar Track password was reset",
    heading: "Password reset by the R&D section",
    paragraphs: [
      `Hello ${staff.user.name},`,
      "Your password was reset by the R&D section. Sign in with the temporary password below; you will be asked to choose a new one immediately.",
    ],
    code: { label: "Temporary password", value: tempPassword },
    cta: { label: "Sign in", url: appUrl("/login") },
  });

  return NextResponse.json({ tempPassword });
}
