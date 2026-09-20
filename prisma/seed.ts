import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const MILESTONES = [
  { code: "DC1", name: "Doctoral Committee Meeting 1", sequence: 1, requiredDocs: ["fee_receipt", "marksheet"] },
  { code: "DC2", name: "Doctoral Committee Meeting 2", sequence: 2, requiredDocs: ["dc1_report", "fee_receipt", "marksheet", "paper_published_report"] },
  { code: "DC3", name: "Doctoral Committee Meeting 3", sequence: 3, requiredDocs: ["fee_receipt", "dc2_report"] },
  { code: "DC4", name: "Doctoral Committee Meeting 4", sequence: 4, requiredDocs: ["fee_receipt", "thesis_evaluation_report"] },
  { code: "DEGREE", name: "Degree Completion", sequence: 5, requiredDocs: ["dc4_report", "fee_receipt"] },
];

async function main() {
  for (const m of MILESTONES) {
    await prisma.milestone.upsert({
      where: { code: m.code },
      update: { name: m.name, sequence: m.sequence, requiredDocs: m.requiredDocs },
      create: m,
    });
  }
  console.log("Seeded milestones: " + MILESTONES.map((m) => m.code).join(", "));

  const email = process.env.RND_ADMIN_BOOTSTRAP_EMAIL;
  const password = process.env.RND_ADMIN_BOOTSTRAP_PASSWORD;

  const adminCount = await prisma.user.count({ where: { role: "RND_ADMIN" } });
  if (adminCount > 0) {
    console.log("An RND_ADMIN user already exists — skipping bootstrap admin.");
    return;
  }
  if (!email || !password) {
    console.log(
      "RND_ADMIN_BOOTSTRAP_EMAIL / RND_ADMIN_BOOTSTRAP_PASSWORD not set — skipping bootstrap admin. " +
        "Set them and re-run `npm run db:seed` to create the first R&D Admin."
    );
    return;
  }
  if (password.length < 10) {
    throw new Error("RND_ADMIN_BOOTSTRAP_PASSWORD must be at least 10 characters.");
  }

  await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      name: "R&D Admin",
      role: "RND_ADMIN",
      passwordHash: await bcrypt.hash(password, 12),
      mustChangePassword: true,
    },
  });
  console.log(`Created bootstrap R&D Admin (${email}).`);
  console.log(">>> Change this password immediately after first login. <<<");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
