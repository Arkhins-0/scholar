# Scholar Track · PhD Scholar Tracking Portal

Tracks a PhD scholar's journey from admission to degree completion through four Doctoral Committee (DC)
review stages, each with document uploads and a two-step approval (Supervisor → R&D section).

**Stack:** Next.js 14 (App Router, TypeScript) · Neon Postgres · Prisma · NextAuth (credentials, JWT) ·
Neon Object Storage (S3-compatible) · Brevo transactional email · Tailwind CSS · Zod

## Roles

| Role | Access |
|---|---|
| Student | Registers with a one-time portal key, submits proposal, uploads milestone documents, resubmits on rejection |
| Staff | One shared pool: the same person can be Supervisor and Co-Supervisor for different students |
| R&D Admin | Generates portal keys, allocates supervisors, manages staff and the DC pool, final approvals, marks meetings/degrees |

## The workflow

```
PROPOSAL → DC1 → DC2 → DC3 → DC4 → DEGREE → COMPLETED

per milestone:
DRAFT → SUBMITTED → SUPERVISOR_APPROVED → RND_APPROVED → MEETING_COMPLETED (or DEGREE_ISSUED)
              ↖ SUPERVISOR_REJECTED / RND_REJECTED → student revises & resubmits
```

All transitions are enforced server-side, every transition writes an `AuditLog` row, every rejection
requires remarks, and a student can never open a locked stage. Every transition also sends a
templated email to the people it concerns (scholar, supervisor, R&D admins).

## Design

The interface follows a GitHub-like system: hairline borders, square corners (no rounded buttons),
a quiet white/near-black canvas, one blue accent, a green primary action, and semantic state labels.
Headings use a serif (Source Serif 4) for an academic tone; the UI uses Inter; keys and codes use
JetBrains Mono. Light and dark themes are both first-class (system default, toggle in the header, remembered per browser).
Public pages (sign in, register, password reset) use a split layout with library photographs from Unsplash in `public/images/`.

## Files & security model

Uploads live in an S3-compatible bucket (Neon Object Storage). The app never stores or exposes a file URL:

- **Only object keys are stored.** Files are viewed through `GET /api/documents/[id]` and
  `GET /api/students/[id]/proposal-document`, which check the viewer's relationship to the student
  (owner / supervisor / co-supervisor / admin) and stream the bytes from the bucket.
- **Uploads are two-step and browser-direct.** `POST /api/upload` mints a 5-minute presigned PUT URL only for the
  student who owns an editable target, for allowed types and sizes; the browser PUTs straight to the bucket
  (so large files avoid the Vercel function body limit); then `POST /api/documents/register` verifies the object
  with `HeadObject` (existence, type, ≤ 10MB) before recording it. Keys carry a 128-bit random nonce.
- Set the bucket to **private** in the Neon console. The app works either way, but private removes any
  reliance on unguessable keys.
- **Portal keys** are stored as SHA-256 hashes (plaintext shown once). **Password-reset tokens** are stored
  as SHA-256 hashes, expire after 1 hour, are single-use, and are rate-limited to 3 per 15 minutes per account.
- Passwords are bcrypt (cost 12); accounts lock for 15 minutes after 5 failed logins; staff/admin
  accounts are created with a temporary password and forced to change it on first login.
- JWT sessions (8h), role-based middleware on `/student/*`, `/staff/*`, `/admin/*`, strict security headers
  and CSP (`connect-src` allows only the app and the storage origin), Zod validation on client and server.

## Email

`lib/email.ts` sends HTML + plain-text email through the Brevo API when `EMAIL_PROVIDER=brevo` and `BREVO_API_KEY`
is set; otherwise it logs the message to the server console (handy in development). Emails sent:
welcome on registration, staff account created / password reset by admin, forgot-password link,
password changed, supervisor requested / allocated, co-supervisor assigned, application submitted /
resubmitted, supervisor decision, R&D decision, meeting completed, degree issued.

## Local development

```bash
npm install
cp .env.example .env         # fill in values (see below)
npx prisma migrate deploy    # applies prisma/migrations against DATABASE_URL
npm run db:seed              # seeds the 5 milestones + bootstrap R&D admin
node --env-file=.env scripts/storage-check.mjs   # verifies the bucket (set S3_BUCKET first)
npm run dev
```

Environment variables (`.env.example`):

| Key | Notes |
|---|---|
| `DATABASE_URL` | Neon **pooled** connection string, with `sslmode=require` |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `http://localhost:3000` locally, production URL on Vercel; also used for links in emails |
| `AWS_ENDPOINT_URL_S3`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` | Neon Object Storage credential (Neon console → Storage) |
| `S3_BUCKET` | Bucket name (create it in the Neon console; `scripts/storage-check.mjs` lists the buckets the credential can see) |
| `EMAIL_PROVIDER` | `brevo` to send email; unset for log mode |
| `BREVO_API_KEY`, `EMAIL_FROM`, `EMAIL_FROM_NAME` | Brevo transactional API key and verified sender |
| `RND_ADMIN_BOOTSTRAP_EMAIL` / `RND_ADMIN_BOOTSTRAP_PASSWORD` | Used once by the seed to create the first admin |

Useful scripts: `scripts/db-check.mjs` (row counts), `scripts/storage-check.mjs` (bucket round-trip; `--create` creates the bucket).

## Deploying to Vercel

1. Push to GitHub, import the repo into Vercel.
2. Create a **Neon** project with a database and an **Object Storage** bucket (set it to private); create a storage credential.
3. Set all env vars from `.env.example` for Production and Preview (`NEXTAUTH_URL` = the deployed URL).
4. Deploy. The `vercel-build` script runs `prisma migrate deploy && prisma db seed && next build`
   (the seed is idempotent: it only creates missing milestones and skips the admin if one exists).
5. Log in as the bootstrap admin and **change the password immediately** (the app forces this).

## First run walkthrough

1. Admin (`/admin/portal-keys`) generates a portal key and hands it to the new scholar.
2. Scholar registers at `/register` with the key, fills the proposal, requests a supervisor.
3. Admin allocates a supervisor (`/admin/supervisor-requests`); this unlocks DC1.
4. Supervisor opens the scholar (`/staff/students/…`), picks 2–5 DC members, optionally a co-supervisor.
5. Scholar uploads DC1 documents (fee receipt, marksheet) and submits.
6. Supervisor approves → admin approves (`/admin/approvals`) → admin marks the meeting completed
   (`/admin/meetings`) → DC2 unlocks. Repeat through DC4 and DEGREE; the final step issues the degree.
