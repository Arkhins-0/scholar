/**
 * End-to-end smoke test for the PhD Scholar Tracking Portal.
 *
 * Drives the real HTTP API of a running server through the entire journey:
 * bootstrap admin -> portal key -> student registration -> proposal ->
 * supervisor allocation -> committee -> DC1 (submit/reject/resubmit/approve/
 * complete) -> DC2 unlock, including the negative authorization cases.
 *
 * Prereqs:
 *   - server running against a DISPOSABLE database that has been seeded
 *     (milestones + bootstrap admin admin@test.local / BootstrapPass123)
 *   - psql access to that database for test fixtures (document rows) via:
 *     SMOKE_PSQL="docker exec scholar-track-pg psql -U postgres -d scholar_track"
 *   - optional: SMOKE_STORAGE=1 (with the S3 env vars set on the server) to also test real
 *     upload (presigned PUT) / proxy / delete against the bucket
 *
 * Usage: node scripts/smoke-test.mjs [baseUrl]
 */
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";

const BASE = process.argv[2] ?? "http://localhost:3100";
const PSQL = (process.env.SMOKE_PSQL ?? "docker exec scholar-track-pg psql -U postgres -d scholar_track").split(" ");

let passed = 0;
let failed = 0;
function check(name, ok, extra = "") {
  if (ok) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`! FAIL  ${name} ${extra}`);
  }
}

function sql(query) {
  const res = spawnSync(PSQL[0], [...PSQL.slice(1), "-t", "-A", "-c", query], { encoding: "utf8" });
  if (res.status !== 0) throw new Error(`psql failed: ${res.stderr}`);
  return res.stdout.trim();
}

class Client {
  constructor() {
    this.cookies = new Map();
  }
  header() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  async req(path, opts = {}) {
    const res = await fetch(BASE + path, {
      ...opts,
      headers: { ...(opts.headers ?? {}), cookie: this.header() },
      redirect: "manual",
    });
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      const name = pair.slice(0, i).trim();
      const value = pair.slice(i + 1).trim();
      if (value) this.cookies.set(name, value);
      else this.cookies.delete(name);
    }
    return res;
  }
  async login(email, password) {
    const csrf = await (await this.req("/api/auth/csrf")).json();
    const res = await this.req("/api/auth/callback/credentials", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ csrfToken: csrf.csrfToken, email, password, json: "true" }),
    });
    const ok = [...this.cookies.keys()].some((k) => k.includes("session-token"));
    return { status: res.status, ok };
  }
  async post(path, body) {
    const res = await this.req(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try {
      data = await res.json();
    } catch {}
    return { status: res.status, data };
  }
  async get(path) {
    const res = await this.req(path);
    return res;
  }
}

const run = randomBytes(3).toString("hex"); // unique emails per run
const email = (name) => `${name}-${run}@test.local`;

console.log(`\nSmoke test against ${BASE} (run ${run})\n`);

// Reset the bootstrap admin to a known state so the test is repeatable.
{
  const bcrypt = (await import("bcryptjs")).default;
  const hash = await bcrypt.hash(process.env.SMOKE_ADMIN_PASSWORD ?? "BootstrapPass123", 12);
  sql(
    `UPDATE "User" SET "passwordHash" = '${hash}', "mustChangePassword" = true, "failedLoginCount" = 0, "lockedUntil" = NULL WHERE email = 'admin@test.local'`
  );
}

// ---------- Admin bootstrap & forced password change ----------
const admin = new Client();
{
  const r = await admin.login("admin@test.local", "wrong-password");
  check("admin login rejects wrong password", !r.ok);
}
{
  const r = await admin.login("admin@test.local", process.env.SMOKE_ADMIN_PASSWORD ?? "BootstrapPass123");
  check("admin login with bootstrap password", r.ok);
}
{
  const r = await admin.post("/api/admin/portal-keys", { count: 1 });
  check("admin API blocked until password change", r.status === 403, `got ${r.status}`);
}
const adminPassword = `AdminPass-${run}-77`;
{
  const r = await admin.post("/api/change-password", {
    currentPassword: process.env.SMOKE_ADMIN_PASSWORD ?? "BootstrapPass123",
    newPassword: adminPassword,
  });
  check("admin forced password change", r.status === 200, `got ${r.status}`);
  const r2 = await admin.login("admin@test.local", adminPassword);
  check("admin re-login with new password", r2.ok);
}

// ---------- Portal keys ----------
let portalKey;
{
  const r = await admin.post("/api/admin/portal-keys", { count: 2, expiresInDays: 7 });
  portalKey = r.data?.keys?.[0];
  check("portal key generation", r.status === 200 && /^PHD(-[A-Z2-9]{4}){3}$/.test(portalKey ?? ""), JSON.stringify(r.data));
}

// ---------- Staff creation ----------
async function createStaff(name) {
  const r = await admin.post("/api/admin/staff", {
    name: `Dr ${name}`,
    email: email(name),
    department: "CSE",
    designation: "Professor",
  });
  if (r.status !== 200) throw new Error(`staff create failed: ${JSON.stringify(r.data)}`);
  return { id: r.data.id, email: email(name), tempPassword: r.data.tempPassword };
}
const sup = await createStaff("supervisor");
const cosup = await createStaff("cosupervisor");
const outsider = await createStaff("outsider");
check("staff accounts created (3)", true);

// DC members are a separate pool R&D curates (no logins), distinct from staff.
async function createDcMember(name) {
  const r = await admin.post("/api/admin/dc-members", { name });
  check(`DC member "${name}" added to pool`, r.status === 200, JSON.stringify(r.data));
  return { id: r.data.id, name };
}
const dcA = await createDcMember("Dr. DC Alpha");
const dcB = await createDcMember("Dr. DC Beta");
{
  const r = await admin.post("/api/admin/staff", { name: "Dup", email: sup.email });
  check("duplicate staff email rejected", r.status === 409, `got ${r.status}`);
}

// ---------- Student registration ----------
const student = new Client();
{
  const r = await student.post("/api/register", {
    portalKey: "PHD-XXXX-XXXX-XXXX",
    name: "Test Scholar",
    email: email("scholar"),
    password: `Scholar-${run}-99`,
  });
  check("registration rejects invalid portal key", r.status === 400, `got ${r.status}`);
}
{
  const r = await student.post("/api/register", {
    portalKey,
    name: "Test Scholar",
    email: email("scholar"),
    password: `Scholar-${run}-99`,
  });
  check("student registration with portal key", r.status === 200, JSON.stringify(r.data));
}
{
  const r = await student.post("/api/register", {
    portalKey,
    name: "Second Scholar",
    email: email("scholar2"),
    password: `Scholar-${run}-98`,
  });
  check("portal key cannot be reused", r.status === 400 || r.status === 409, `got ${r.status}`);
}
{
  const r = await student.login(email("scholar"), `Scholar-${run}-99`);
  check("student login", r.ok);
}

const studentId = sql(`SELECT sp.id FROM "StudentProfile" sp JOIN "User" u ON u.id = sp."userId" WHERE u.email = '${email("scholar")}'`);

// ---------- Proposal & supervisor request ----------
{
  const r = await student.post("/api/milestones/DC1/open", undefined);
  check("DC1 locked before supervisor allocation", r.status === 403, `got ${r.status}`);
}
{
  const r = await student.post("/api/proposal/request-supervisor", undefined);
  check("supervisor request blocked without proposal", r.status === 400, `got ${r.status}`);
}
{
  const r = await student.post("/api/proposal", {
    title: "Adaptive Scheduling in Serverless Systems",
    domain: "Data Science & Analytics",
  });
  check("proposal saved", r.status === 200, JSON.stringify(r.data));
  const bad = await student.post("/api/proposal", {
    title: "Adaptive Scheduling in Serverless Systems",
    domain: "Astrology",
  });
  check("domain outside the predetermined list rejected", bad.status === 400, `got ${bad.status}`);
}
{
  const r = await student.post("/api/proposal/request-supervisor", undefined);
  check("supervisor request blocked without proposed-work PDF", r.status === 400, `got ${r.status}`);
}
if (process.env.SMOKE_STORAGE === "1") {
  // Real two-step upload: presigned PUT straight to the bucket, then register the key.
  const bytes = Buffer.from(`%PDF-1.4 proposal ${run}`);
  const start = await student.post("/api/upload", {
    kind: "proposal",
    fileName: "proposal.pdf",
    contentType: "application/pdf",
    size: bytes.length,
  });
  check("presigned upload URL issued", start.status === 200 && !!start.data?.url, JSON.stringify(start.data));
  const put = await fetch(start.data.url, { method: "PUT", headers: { "Content-Type": "application/pdf" }, body: bytes });
  check("PUT to storage accepted", put.ok, `got ${put.status}`);
  const reg = await student.post("/api/documents/register", { key: start.data.key });
  check("proposed-work PDF registered", reg.status === 200, JSON.stringify(reg.data));
  const view = await student.get(`/api/students/${studentId}/proposal-document`);
  check("owner can view proposal document via proxy", view.status === 200, `got ${view.status}`);
} else {
  const fakeKey = `proposal/${studentId}/${"0".repeat(32)}-prop.pdf`;
  sql(
    `UPDATE "StudentProfile" SET "proposalStorageKey"='${fakeKey}', "proposalFileName"='prop.pdf', "proposalContentType"='application/pdf', "proposalSize"=100 WHERE id='${studentId}'`
  );
  console.log("  SKIP  real proposal upload (set SMOKE_STORAGE=1 to exercise the bucket) — using DB fixture");
}
{
  const r = await student.post("/api/proposal/request-supervisor", undefined);
  check("supervisor allocation requested", r.status === 200, JSON.stringify(r.data));
  const r2 = await student.post("/api/proposal/request-supervisor", undefined);
  check("duplicate supervisor request rejected", r2.status === 409, `got ${r2.status}`);
}

// ---------- Supervisor allocation (admin) ----------
{
  const r = await admin.post("/api/admin/supervisor-requests/allocate", { studentId, staffId: sup.id });
  check("supervisor allocated", r.status === 200, JSON.stringify(r.data));
  const r2 = await admin.post("/api/admin/supervisor-requests/allocate", { studentId, staffId: sup.id });
  check("re-allocation without pending request rejected", r2.status === 409, `got ${r2.status}`);
}

// ---------- Staff first login & committee setup ----------
const supClient = new Client();
{
  const r = await supClient.login(sup.email, sup.tempPassword);
  check("supervisor login with temp password", r.ok);
  const supPassword = `SupPass-${run}-55`;
  const r2 = await supClient.post("/api/change-password", { currentPassword: sup.tempPassword, newPassword: supPassword });
  check("supervisor forced password change", r2.status === 200, `got ${r2.status}`);
  await supClient.login(sup.email, supPassword);
}
const BOGUS_UUID = "00000000-0000-4000-8000-000000000000";
{
  const rr = await supClient.post("/api/admin/dc-members", { name: "Sneaky" });
  check("staff cannot add DC members (admin only)", rr.status === 403, `got ${rr.status}`);
  const r = await supClient.post(`/api/staff/students/${studentId}/committee`, { dcMemberIds: [dcA.id] });
  check("committee with 1 member rejected", r.status === 400, `got ${r.status}`);
  const r2 = await supClient.post(`/api/staff/students/${studentId}/committee`, { dcMemberIds: [dcA.id, BOGUS_UUID] });
  check("committee with unknown DC member rejected", r2.status === 400, `got ${r2.status}`);
  const r3 = await supClient.post(`/api/staff/students/${studentId}/committee`, { dcMemberIds: [dcA.id, dcB.id] });
  check("committee of 2 set from the DC pool", r3.status === 200, JSON.stringify(r3.data));
}
{
  const r = await supClient.post(`/api/staff/students/${studentId}/co-supervisor`, { coSupervisorId: sup.id });
  check("self as co-supervisor rejected", r.status === 400, `got ${r.status}`);
  const r2 = await supClient.post(`/api/staff/students/${studentId}/co-supervisor`, { coSupervisorId: BOGUS_UUID });
  check("unknown co-supervisor rejected", r2.status === 400, `got ${r2.status}`);
  const r3 = await supClient.post(`/api/staff/students/${studentId}/co-supervisor`, { coSupervisorId: cosup.id });
  check("co-supervisor assigned", r3.status === 200, JSON.stringify(r3.data));
}
{
  // outsider staff cannot set this student's committee
  const c = new Client();
  await c.login(outsider.email, outsider.tempPassword);
  await c.post("/api/change-password", { currentPassword: outsider.tempPassword, newPassword: `OutPass-${run}-44` });
  await c.login(outsider.email, `OutPass-${run}-44`);
  const r = await c.post(`/api/staff/students/${studentId}/committee`, { dcMemberIds: [dcA.id, dcB.id] });
  check("non-supervisor cannot set committee", r.status === 403, `got ${r.status}`);
  outsider.client = c;
}

// ---------- DC1 application ----------
let dc1AppId;
{
  const r = await student.post("/api/milestones/DC1/open", undefined);
  dc1AppId = r.data?.id;
  check("DC1 application opened", r.status === 200 && !!dc1AppId, JSON.stringify(r.data));
}
{
  const r = await student.post("/api/milestones/DC2/open", undefined);
  check("DC2 still locked", r.status === 403, `got ${r.status}`);
}
{
  const r = await student.post(`/api/applications/${dc1AppId}/submit`, undefined);
  check("submit blocked with missing documents", r.status === 400, `got ${r.status}`);
}

// insert fixture documents directly (blob upload tested separately below)
let feeDocId;
{
  feeDocId = `smokedoc${run}fee`;
  sql(
    `INSERT INTO "MilestoneDocument" (id, "applicationId", "docType", "storageKey", "fileName", "contentType", size) VALUES ` +
      `('${feeDocId}', '${dc1AppId}', 'fee_receipt', 'documents/${dc1AppId}/fee_receipt/${"0".repeat(32)}-fee.pdf', 'fee.pdf', 'application/pdf', 100), ` +
      `('smokedoc${run}mark', '${dc1AppId}', 'marksheet', 'documents/${dc1AppId}/marksheet/${"0".repeat(32)}-marks.pdf', 'marks.pdf', 'application/pdf', 100)`
  );
  check("fixture documents inserted", true);
}
{
  const r = await student.post(`/api/applications/${dc1AppId}/submit`, undefined);
  check("DC1 submitted with all documents", r.status === 200, JSON.stringify(r.data));
}

// ---------- Review chain ----------
{
  const r = await outsider.client.post(`/api/applications/${dc1AppId}/supervisor-review`, { decision: "APPROVE", remarks: "" });
  check("non-supervisor cannot review", r.status === 404, `got ${r.status}`);
}
{
  const r = await supClient.post(`/api/applications/${dc1AppId}/supervisor-review`, { decision: "REJECT", remarks: "" });
  check("rejection without remarks blocked", r.status === 400, `got ${r.status}`);
  const r2 = await supClient.post(`/api/applications/${dc1AppId}/supervisor-review`, { decision: "REJECT", remarks: "Fee receipt is illegible." });
  check("supervisor rejection with remarks", r2.status === 200, JSON.stringify(r2.data));
}
{
  const r = await student.post(`/api/applications/${dc1AppId}/submit`, undefined);
  check("student resubmission after rejection", r.status === 200, JSON.stringify(r.data));
}
{
  const r = await supClient.post(`/api/applications/${dc1AppId}/supervisor-review`, { decision: "APPROVE", remarks: "Looks good." });
  check("supervisor approval", r.status === 200, JSON.stringify(r.data));
  const r2 = await supClient.post(`/api/applications/${dc1AppId}/supervisor-review`, { decision: "APPROVE", remarks: "" });
  check("double review blocked", r2.status === 409, `got ${r2.status}`);
}
{
  const r = await student.post(`/api/applications/${dc1AppId}/complete`, undefined);
  check("student cannot mark meeting completed", r.status === 403, `got ${r.status}`);
  const r2 = await admin.post(`/api/applications/${dc1AppId}/complete`, undefined);
  check("meeting completion blocked before R&D approval", r2.status === 409, `got ${r2.status}`);
}
{
  const r = await admin.post(`/api/applications/${dc1AppId}/rnd-review`, { decision: "APPROVE", remarks: "Cleared for DC1." });
  check("R&D approval", r.status === 200, JSON.stringify(r.data));
}
{
  const r = await admin.post(`/api/applications/${dc1AppId}/complete`, undefined);
  check("meeting marked completed", r.status === 200, JSON.stringify(r.data));
}
{
  const r = await student.post("/api/milestones/DC2/open", undefined);
  check("DC2 unlocked after DC1 meeting", r.status === 200, JSON.stringify(r.data));
  const r2 = await student.post("/api/milestones/DC3/open", undefined);
  check("DC3 still locked", r2.status === 403, `got ${r2.status}`);
}
{
  const stage = sql(`SELECT "currentMilestoneCode" FROM "StudentProfile" WHERE id = '${studentId}'`);
  check("student stage advanced to DC2", stage === "DC2", `got ${stage}`);
}

// ---------- Document proxy authorization ----------
{
  const r = await outsider.client.get(`/api/documents/${feeDocId}`);
  check("unrelated staff blocked from document (403)", r.status === 403, `got ${r.status}`);
  // supervisor passes authz; fixture URL is fake so the proxy reports upstream failure (502), which proves
  // the request got past the permission check without leaking a blob URL
  const r2 = await supClient.get(`/api/documents/${feeDocId}`);
  check("supervisor passes document authz (502 on fake upstream)", r2.status === 502, `got ${r2.status}`);
  const anon = new Client();
  const r3 = await anon.get(`/api/documents/${feeDocId}`);
  check("anonymous blocked from document (401)", r3.status === 401, `got ${r3.status}`);
  const r4 = await outsider.client.get(`/api/students/${studentId}/proposal-document`);
  check("unrelated staff blocked from proposal document", r4.status === 403, `got ${r4.status}`);
  const r5 = await supClient.get(`/api/students/${studentId}/proposal-document`);
  const expected = process.env.SMOKE_STORAGE === "1" ? 200 : 502;
  check("supervisor can access proposal document", r5.status === expected, `got ${r5.status}, expected ${expected}`);
}

// ---------- Real upload / proxy / delete against the bucket (SMOKE_STORAGE=1) ----------
if (process.env.SMOKE_STORAGE === "1") {
  const content = `smoke test ${run}`;
  const bytes = Buffer.from(`%PDF-1.4 ${content}`);
  // student's DC2 draft application
  const dc2AppId = (await student.post("/api/milestones/DC2/open", undefined)).data.id;
  const start = await student.post("/api/upload", {
    kind: "milestone",
    applicationId: dc2AppId,
    docType: "fee_receipt",
    fileName: "smoke.pdf",
    contentType: "application/pdf",
    size: bytes.length,
  });
  check("presigned URL issued for milestone document", start.status === 200 && !!start.data?.url, JSON.stringify(start.data));
  const put = await fetch(start.data.url, { method: "PUT", headers: { "Content-Type": "application/pdf" }, body: bytes });
  check("PUT to storage accepted", put.ok, `got ${put.status}`);
  const reg = await student.post("/api/documents/register", { key: start.data.key });
  check("upload registered", reg.status === 200 && !!reg.data?.id, JSON.stringify(reg.data));
  const docId = reg.data?.id;

  const forged = await student.post("/api/documents/register", { key: "documents/x/fee_receipt/a.pdf" });
  check("malformed key rejected", forged.status === 400, `got ${forged.status}`);
  const missing = await student.post("/api/documents/register", {
    key: `documents/${dc2AppId}/fee_receipt/${"f".repeat(32)}-nothing.pdf`,
  });
  check("key with no object behind it rejected", missing.status === 400, `got ${missing.status}`);
  const wrongType = await student.post("/api/upload", {
    kind: "milestone",
    applicationId: dc2AppId,
    docType: "fee_receipt",
    fileName: "evil.exe",
    contentType: "application/x-msdownload",
    size: 10,
  });
  check("disallowed content type refused a presigned URL", wrongType.status === 400, `got ${wrongType.status}`);

  const view = await student.get(`/api/documents/${docId}`);
  const body = view.status === 200 ? await view.text() : "";
  check("owner can stream document via proxy", view.status === 200 && body.includes(content), `got ${view.status}`);
  const blocked = await outsider.client.get(`/api/documents/${docId}`);
  check("outsider blocked from real document", blocked.status === 403, `got ${blocked.status}`);

  const del = await student.req(`/api/documents/${docId}`, { method: "DELETE" });
  check("owner deletes document (object + row)", del.status === 200, `got ${del.status}`);
  const gone = await student.get(`/api/documents/${docId}`);
  check("deleted document is gone", gone.status === 404, `got ${gone.status}`);

  // the proposal is locked once a supervisor is allocated
  const late = await student.post("/api/upload", { kind: "proposal", fileName: "late.pdf", contentType: "application/pdf", size: 10 });
  check("proposal upload refused after supervisor allocation", late.status === 409, `got ${late.status}`);
} else {
  console.log("  SKIP  storage upload tests (set SMOKE_STORAGE=1 to exercise the bucket)");
}

// ---------- Role separation on pages ----------
{
  const r = await student.get("/admin/dashboard");
  check("student redirected away from /admin", r.status === 307 || r.status === 302, `got ${r.status}`);
  const r2 = await student.get("/student/dashboard");
  check("student dashboard renders", r2.status === 200, `got ${r2.status}`);
  const r3 = await supClient.get(`/staff/students/${studentId}`);
  check("supervisor student page renders", r3.status === 200, `got ${r3.status}`);
  const r4 = await admin.get("/admin/dashboard");
  check("admin dashboard renders", r4.status === 200, `got ${r4.status}`);
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
