/** Prints row counts so you can confirm the database is migrated and seeded. Usage: node --env-file=.env scripts/db-check.mjs */
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const [users, admins, milestones, students, staff, keys] = await Promise.all([
  p.user.count(),
  p.user.count({ where: { role: "RND_ADMIN" } }),
  p.milestone.count(),
  p.studentProfile.count(),
  p.staffProfile.count(),
  p.portalKey.count(),
]);
console.log({ users, admins, milestones, students, staff, keys });
await p.$disconnect();
