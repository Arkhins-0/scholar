import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { jsonError, parseBody } from "@/lib/api";
import { staffCreateSchema } from "@/lib/schemas";
import { generateTempPassword, hashPassword } from "@/lib/passwords";
import { audit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { appUrl } from "@/lib/site";

/**
 * Create a staff account. A temporary password is returned ONCE to the admin
 * (and emailed to the staff member when email is configured); the account is
 * forced to change it on first login.
 */
export async function POST(req: Request) {
  const auth = await requireRole("RND_ADMIN");
  if (auth.error) return auth.error;

  const body = await parseBody(req, staffCreateSchema);
  if (body.error) return body.error;
  const { name, email, phone, department, designation } = body.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return jsonError(409, "An account with this email already exists");

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  const user = await prisma.user.create({
    data: {
      email,
      name,
      role: "STAFF",
      passwordHash,
      phone: phone || null,
      mustChangePassword: true,
      staffProfile: {
        create: {
          department: department || null,
          designation: designation || null,
        },
      },
    },
    include: { staffProfile: true },
  });

  await audit({
    actorId: auth.user.id,
    action: "STAFF_CREATED",
    entityType: "StaffProfile",
    entityId: user.staffProfile!.id,
    details: { email },
  });

  await sendEmail({
    to: email,
    subject: "Your Scholar Track staff account",
    heading: `Welcome, ${name}`,
    paragraphs: [
      "The R&D section has created a staff account for you on the PhD Scholar Tracking Portal. Sign in with your email address and the temporary password below.",
      "You will be asked to set a new password on first login.",
    ],
    code: { label: "Temporary password", value: tempPassword },
    cta: { label: "Sign in", url: appUrl("/login") },
  });

  return NextResponse.json({ id: user.staffProfile!.id, tempPassword });
}
