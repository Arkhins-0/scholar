/**
 * Vercel build: migrate -> seed -> next build.
 *
 * Prisma Migrate takes a Postgres advisory lock, which does not work through
 * Neon's pooled (PgBouncer) endpoint and times out (P1002). Migrations must use
 * the DIRECT endpoint. If DIRECT_DATABASE_URL is not configured we derive it
 * from DATABASE_URL by dropping the "-pooler" host segment.
 */
import { spawnSync } from "node:child_process";

if (!process.env.DIRECT_DATABASE_URL && process.env.DATABASE_URL) {
  process.env.DIRECT_DATABASE_URL = process.env.DATABASE_URL.replace("-pooler.", ".");
  console.log("DIRECT_DATABASE_URL not set; derived it from DATABASE_URL for migrations.");
}

function run(cmd) {
  console.log(`\n$ ${cmd}`);
  const r = spawnSync(cmd, { stdio: "inherit", shell: true, env: process.env });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

run("npx prisma migrate deploy");
run("npx prisma db seed");
run("npx next build");
