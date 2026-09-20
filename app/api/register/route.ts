import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseBody } from "@/lib/api";
import { registerSchema } from "@/lib/schemas";
import { hashPortalKey } from "@/lib/portal-key";
import { hashPassword } from "@/lib/passwords";
import { audit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { appUrl } from "@/lib/site";

export async function POST(req: Request) {
  const body = await parseBody(req, registerSchema);
  if (body.error) return body.error;
  const { portalKey, name, email, password, registrationNo, phone } = body.data;

  const keyHash = hashPortalKey(portalKey);
  const key = await prisma.portalKey.findUnique({ where: { keyHash } });
  if (!key || key.isUsed) return jsonError(400, "Invalid or already-used portal key");
  if (key.expiresAt && key.expiresAt < new Date()) return jsonError(400, "This portal key has expired");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return jsonError(409, "An account with this email already exists");

  if (registrationNo) {
    const regTaken = await prisma.studentProfile.findUnique({ where: { registrationNo } });
    if (regTaken) return jsonError(409, "This registration number is already in use");
  }

  const passwordHash = await hashPassword(password);

  let studentProfileId: string;
  try {
    studentProfileId = await prisma.$transaction(async (tx) => {
      // Atomically claim the key — guards against two registrations racing on the same key.
      const claimed = await tx.portalKey.updateMany({
        where: { id: key.id, isUsed: false },
        data: { isUsed: true },
      });
      if (claimed.count !== 1) throw new Error("KEY_TAKEN");

      const user = await tx.user.create({
        data: { email, name, role: "STUDENT", passwordHash, phone: phone || null },
      });
      const profile = await tx.studentProfile.create({
        data: {
          userId: user.id,
          portalKeyId: key.id,
          registrationNo: registrationNo || null,
        },
      });
      return profile.id;
    });
  } catch (e) {
    if (e instanceof Error && e.message === "KEY_TAKEN") {
      return jsonError(409, "This portal key was just used by another registration");
    }
    console.error("registration failed", e);
    return jsonError(500, "Registration failed — please try again");
  }

  await audit({
    action: "STUDENT_REGISTERED",
    entityType: "StudentProfile",
    entityId: studentProfileId,
    details: { email, portalKeyId: key.id },
  });

  await sendEmail({
    to: email,
    subject: "Welcome to Scholar Track",
    heading: `Welcome, ${name}`,
    paragraphs: [
      "Your scholar account has been created and your portal key is now tied to it.",
      "Next step: open the Proposal page, enter your research title and domain, upload the proposed-work PDF, then request supervisor allocation. You will be notified by email at every stage of the review process.",
    ],
    cta: { label: "Open your dashboard", url: appUrl("/student/dashboard") },
  });

  return NextResponse.json({ ok: true });
}
