You are an expert full-stack engineer. Build a complete, production-ready, deployable web application called the **PhD Scholar Tracking Portal**. Deploy target is **Vercel**, database is **Neon Postgres** (serverless Postgres, pooled connection). Build the entire application end-to-end — schema, backend, frontend, auth, file uploads, and deployment config. Do not leave placeholder/TODO logic in core flows; everything described below must actually work.

## 1. What this system does

This portal tracks a PhD scholar's journey from admission to degree completion through four Doctoral Committee (DC) review stages, each requiring document uploads and a two-step approval (Supervisor, then R&D section).

There are three roles:
- **Student (Scholar)** — the PhD candidate
- **Staff** — can be a Supervisor to one student and a Co-Supervisor to another and a DC member for a third, simultaneously. One shared pool.
- **R&D Admin** — the department office that runs the whole process (generates portal keys, allocates supervisors, gives final approval, manages the staff pool, issues degree certificates)

## 2. End-to-end user journey

1. **Onboarding**: R&D Admin generates a unique one-time **portal key** and gives it to a newly admitted student (outside the system, e.g. in person or by email). The student visits the portal, enters the portal key, and creates their account (name, email, password). The key is marked used and permanently tied to that account.
2. **Proposal & supervisor request**: The student fills in **Title**, **Research Domain**, and **Proposed Work** (rich text / long text), then submits a request for supervisor allocation.
3. **Supervisor allocation**: R&D Admin sees the pending request (with title/domain/proposed work visible) and manually allocates a Staff member from the pool as **Supervisor**.
4. **Committee setup**: The allocated Supervisor sees the student's title, domain, and proposed work, then:
 - selects 2–5 **DC members** from the staff pool for this student's Doctoral Committee
 - optionally allocates a **Co-Supervisor** from the staff pool
5. **DC1 application**: Student uploads **Fee Receipt** + **Marksheet** and submits the DC1 application. Supervisor reviews and approves/rejects (with remarks). If approved, it moves to R&D, who approves/rejects again (with remarks). Only after R&D approval is the student cleared for the DC1 meeting. R&D later marks the DC1 meeting as **completed** (this happens outside the system, in person) which unlocks DC2.
6. **DC2 application** (unlocked after DC1 meeting is marked completed): Student uploads **DC1 Report**, **Fee Receipt**, **Marksheet**, and **Published Paper Report**. Same two-step approval (Supervisor → R&D) → meeting completion by R&D unlocks DC3.
7. **DC3 application**: Student uploads **Fee Receipt** + **DC2 Report**. Same approval chain → meeting completion unlocks DC4.
8. **DC4 application**: Student uploads **Fee Receipt** + **Thesis Evaluation Report**. Same approval chain → meeting completion unlocks the Degree stage.
9. **Degree completion**: Student uploads **DC4 Report** + **Fee Receipt**. Same approval chain. On final R&D approval, R&D marks the degree as **issued**, and a completion record (with date) appears on the student's dashboard.

At every stage, if Supervisor or R&D rejects, the application goes back to the student with remarks, editable documents, and a resubmit action — it does not silently dead-end.

## 3. Roles & dashboards

| Role | Dashboard? | Can do |
|---|---|---|
| Student | Yes | Register with portal key, submit proposal, apply for supervisor, view current stage/timeline, upload documents per stage, view remarks, resubmit on rejection, view final degree status |
| Supervisor (a Staff record acting in this role for a given student) | Yes | View assigned students, view each student's proposal, select DC members, assign co-supervisor, review & approve/reject each stage's application with remarks |
| Co-Supervisor (same Staff pool, different relation) | Yes, scoped | View (read + light comment) the students they co-supervise |
| DC Member (same Staff pool, assignment only) | No dedicated dashboard | Purely a committee-membership record for reporting; do not build UI screens for this role beyond "appears in the committee list" |
| R&D Admin | Yes | Generate portal keys, allocate supervisors, manage the staff pool (add/edit staff), give final approval/rejection on every stage for every student, mark DC meetings as completed, issue degree certificates, see a global list/filter of all students by stage/domain/supervisor |

Important: Supervisor, Co-Supervisor, and DC Member are **roles a Staff record holds relative to a specific student**, not three separate tables. The same person can be Supervisor for Student A and Co-Supervisor for Student B at the same time.

## 4. Tech stack

- **Next.js 14+ (App Router)**, TypeScript, deployed on Vercel
- **Neon Postgres** as the database
- **Prisma** as the ORM (schema below)
- **Auth**: NextAuth.js with Credentials provider, bcrypt-hashed passwords, JWT session, role stored in the session token, middleware for route protection per role
- **File storage**: **Vercel Blob** (`@vercel/blob`) for all uploaded files (fee receipts, marksheets, reports). Store only the resulting URL + metadata in Postgres — never store file bytes in the DB.
- **Styling**: Tailwind CSS, clean and functional admin/dashboard aesthetic
- **Validation**: Zod on both client forms and API route inputs
- **Email (optional but recommended)**: Resend, for notifying students/staff on status changes — build this as a small abstraction so it can be no-op'd if no API key is configured

## 5. Environment variables

Never hardcode secrets in source. Read everything from `process.env`. Create a `.env.example` with these keys (values blank):

```
DATABASE_URL=            # Neon pooled connection string, sslmode=require
NEXTAUTH_SECRET=
NEXTAUTH_URL=
BLOB_READ_WRITE_TOKEN=   # Vercel Blob
RESEND_API_KEY=          # optional, for email notifications
RND_ADMIN_BOOTSTRAP_EMAIL=
RND_ADMIN_BOOTSTRAP_PASSWORD=
```

`.env.local` must be in `.gitignore`. In Vercel, all of these are set as Project Environment Variables (Production + Preview), never committed.

## 6. Database schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserRole {
  STUDENT
  STAFF
  RND_ADMIN
}

enum ApplicationStatus {
  DRAFT
  SUBMITTED
  SUPERVISOR_APPROVED
  SUPERVISOR_REJECTED
  RND_APPROVED
  RND_REJECTED
  MEETING_COMPLETED   // unlocks the next milestone
  DEGREE_ISSUED       // only used on the DEGREE milestone
}

enum SupervisorRequestStatus {
  NOT_REQUESTED
  PENDING
  ALLOCATED
}

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  name         String
  role         UserRole
  phone        String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  studentProfile StudentProfile?
  staffProfile   StaffProfile?
}

model PortalKey {
  id            String    @id @default(cuid())
  key           String    @unique
  isUsed        Boolean   @default(false)
  generatedById String
  generatedBy   User      @relation(fields: [generatedById], references: [id])
  createdAt     DateTime  @default(now())
  expiresAt     DateTime?

  usedByStudent StudentProfile?
}

model StaffProfile {
  id            String  @id @default(cuid())
  userId        String  @unique
  user          User    @relation(fields: [userId], references: [id])
  department    String?
  designation   String?

  supervisingStudents   StudentProfile[] @relation("Supervisor")
  coSupervisingStudents StudentProfile[] @relation("CoSupervisor")
  dcMemberships         DcMembership[]
}

model StudentProfile {
  id             String   @id @default(cuid())
  userId         String   @unique
  user           User     @relation(fields: [userId], references: [id])
  registrationNo String?  @unique

  portalKeyId    String   @unique
  portalKey      PortalKey @relation(fields: [portalKeyId], references: [id])

  title          String?
  domain         String?
  proposedWork   String?  @db.Text

  supervisorRequestStatus SupervisorRequestStatus @default(NOT_REQUESTED)
  supervisorId   String?
  supervisor     StaffProfile? @relation("Supervisor", fields: [supervisorId], references: [id])
  coSupervisorId String?
  coSupervisor   StaffProfile? @relation("CoSupervisor", fields: [coSupervisorId], references: [id])

  currentMilestoneCode String @default("PROPOSAL") // PROPOSAL, DC1, DC2, DC3, DC4, DEGREE, COMPLETED

  dcMembers      DcMembership[]
  applications   MilestoneApplication[]

  createdAt DateTime @default(now())
}

model DcMembership {
  id         String @id @default(cuid())
  studentId  String
  student    StudentProfile @relation(fields: [studentId], references: [id])
  staffId    String
  staff      StaffProfile   @relation(fields: [staffId], references: [id])
  assignedAt DateTime @default(now())

  @@unique([studentId, staffId])
}

model Milestone {
  id           String @id @default(cuid())
  code         String @unique // DC1, DC2, DC3, DC4, DEGREE
  name         String
  sequence     Int
  requiredDocs String[] // e.g. ["fee_receipt", "marksheet"]

  applications MilestoneApplication[]
}

model MilestoneApplication {
  id            String   @id @default(cuid())
  studentId     String
  student       StudentProfile @relation(fields: [studentId], references: [id])
  milestoneId   String
  milestone     Milestone @relation(fields: [milestoneId], references: [id])

  status        ApplicationStatus @default(DRAFT)

  submittedAt          DateTime?
  supervisorReviewedAt DateTime?
  supervisorRemarks    String?
  rndReviewedAt        DateTime?
  rndRemarks           String?
  meetingCompletedAt   DateTime?   // R&D marks the DC meeting done -> unlocks next stage
  degreeIssuedAt       DateTime?   // only set on the DEGREE milestone

  documents     MilestoneDocument[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([studentId, milestoneId])
}

model MilestoneDocument {
  id            String   @id @default(cuid())
  applicationId String
  application   MilestoneApplication @relation(fields: [applicationId], references: [id])
  docType       String   // fee_receipt, marksheet, dc1_report, paper_published_report, dc2_report, thesis_evaluation_report, dc4_report
  fileUrl       String
  fileName      String
  uploadedAt    DateTime @default(now())
}

model AuditLog {
  id         String   @id @default(cuid())
  actorId    String?
  action     String
  entityType String
  entityId   String
  details    Json?
  createdAt  DateTime @default(now())
}
```

Run this through Prisma migrations (`prisma migrate dev` locally, `prisma migrate deploy` in the Vercel build step).

## 7. Milestone → required documents map

Seed the `Milestone` table with exactly these five rows on first setup:

| Code | Name | Sequence | Required documents |
|---|---|---|---|
| DC1 | Doctoral Committee Meeting 1 | 1 | fee_receipt, marksheet |
| DC2 | Doctoral Committee Meeting 2 | 2 | dc1_report, fee_receipt, marksheet, paper_published_report |
| DC3 | Doctoral Committee Meeting 3 | 3 | fee_receipt, dc2_report |
| DC4 | Doctoral Committee Meeting 4 | 4 | fee_receipt, thesis_evaluation_report |
| DEGREE | Degree Completion | 5 | dc4_report, fee_receipt |

A student can only open the application form for a milestone if the previous milestone's status is `MEETING_COMPLETED` (or, for DEGREE, the DC4 application is `MEETING_COMPLETED`). Enforce this server-side in the API route, not just in the UI.

## 8. Approval state machine (applies uniformly to DC1, DC2, DC3, DC4, DEGREE)

```
DRAFT
  -> (student submits with all required docs uploaded) -> SUBMITTED
SUBMITTED
  -> (supervisor approves) -> SUPERVISOR_APPROVED
  -> (supervisor rejects, with remarks) -> SUPERVISOR_REJECTED -> student edits & resubmits -> SUBMITTED
SUPERVISOR_APPROVED
  -> (R&D approves) -> RND_APPROVED
  -> (R&D rejects, with remarks) -> RND_REJECTED -> student edits & resubmits -> SUBMITTED
RND_APPROVED
  -> (R&D marks the meeting/degree as completed) -> MEETING_COMPLETED (or DEGREE_ISSUED for the DEGREE milestone)
```

Every transition writes an `AuditLog` row (actor, action, entity, timestamp). Every rejection requires non-empty remarks.

## 9. Routes / pages

**Public**
- `/register` — enter portal key + create account
- `/login`

**Student** (`/student/*`, middleware-protected, role=STUDENT)
- `/student/dashboard` — stage timeline (PROPOSAL → DC1 → DC2 → DC3 → DC4 → DEGREE) with status badges, current action needed
- `/student/proposal` — submit/edit title, domain, proposed work; button to request supervisor allocation (disabled once allocated)
- `/student/milestones/[code]` — upload required docs for the currently unlocked milestone, view remarks from prior rejections, submit/resubmit

**Staff** (`/staff/*`, middleware-protected, role=STAFF)
- `/staff/dashboard` — list of students where this staff is Supervisor or Co-Supervisor, with pending-review counts
- `/staff/students/[id]` — view student's proposal; if Supervisor: select DC members (multi-select from staff pool), assign/change co-supervisor, review & approve/reject each submitted milestone application with remarks; if Co-Supervisor: read-only view of the same

**R&D Admin** (`/admin/*`, middleware-protected, role=RND_ADMIN)
- `/admin/dashboard` — counts by stage, pending approvals queue across all students
- `/admin/portal-keys` — generate new portal keys, view used/unused list
- `/admin/staff` — add/edit staff (creates their User + StaffProfile + login credentials)
- `/admin/supervisor-requests` — pending PENDING requests, allocate a Supervisor
- `/admin/approvals` — every application currently at SUPERVISOR_APPROVED, approve/reject with remarks
- `/admin/meetings` — every application at RND_APPROVED, mark meeting completed / degree issued
- `/admin/students` — searchable/filterable list of all students (by stage, domain, supervisor)

## 10. File uploads

Use `@vercel/blob`'s client upload flow. Accept only PDF/JPG/PNG, max 10MB per file. On upload, create a `MilestoneDocument` row linked to the current (DRAFT or rejected) `MilestoneApplication`, storing `fileUrl`, `fileName`, `docType`. Block submission until every `docType` in the milestone's `requiredDocs` has at least one uploaded document.

## 11. Auth & bootstrapping

- Students self-register via portal key (portal key must exist, be unused, and not expired).
- Staff accounts are created directly by R&D Admin in `/admin/staff` (system generates a temporary password, shown once to the admin to relay to the staff member, or emailed via Resend if configured); staff should be forced to change password on first login.
- Bootstrap the very first R&D Admin account via a seed script (`prisma/seed.ts`) that reads `RND_ADMIN_BOOTSTRAP_EMAIL` / `RND_ADMIN_BOOTSTRAP_PASSWORD` from env and creates one RND_ADMIN user if none exists. Print a reminder to change this password after first login.

## 12. Build order

1. Scaffold Next.js + TypeScript + Tailwind project
2. Add Prisma, write schema above, run first migration against Neon
3. Build auth (NextAuth credentials, middleware, role-based route guards)
4. Seed script for Milestones + first R&D Admin
5. Portal key generation + student registration flow
6. Student proposal form + supervisor allocation request
7. R&D admin: staff management, supervisor allocation, portal key generation
8. Supervisor: DC member selection, co-supervisor assignment
9. Milestone application flow (upload, submit, approve/reject at both levels, meeting completion) — build DC1 first, then generalize the same components/API routes for DC2–DC4/DEGREE using the `Milestone.code` and `requiredDocs`
10. Dashboards for all three roles with the stage timeline component
11. Audit log wiring on every state transition
12. Polish: empty states, loading states, rejection/remarks UI, basic email notifications if `RESEND_API_KEY` present

## 13. Deployment to Vercel

- Push to a GitHub repo, import into Vercel
- Set all env vars from section 5 in Vercel Project Settings (Production and Preview)
- Add `prisma migrate deploy` to the Vercel build command (e.g. `prisma migrate deploy && next build`)
- Confirm the Neon connection string includes `sslmode=require` (already required for Neon) and use Neon's **pooled** connection string for serverless/edge compatibility
- Enable Vercel Blob storage for the project and generate the `BLOB_READ_WRITE_TOKEN`

## 14. Suggested enhancements (optional — include if time allows)

- Email notifications on every status change (submitted, approved, rejected, meeting completed)
- Downloadable/printable PDF completion certificate on `DEGREE_ISSUED`
- Deadline/reminder dates per milestone with visual warnings when overdue
- R&D-side CSV export of all students and their current stage
- A domain-tag filter to help R&D match students to supervisors with relevant expertise

## 15. Non-negotiables

- No hardcoded secrets anywhere in source code — everything through `process.env`
- Every approval/rejection transition is enforced server-side (not just hidden in the UI)
- A student can never skip a milestone or upload documents for a locked stage
- Every rejection requires remarks and puts the application back in an editable state for the student