// Ordered journey stages. PROPOSAL and COMPLETED are student states, not Milestone rows.
export const STAGES = ["PROPOSAL", "DC1", "DC2", "DC3", "DC4", "DEGREE", "COMPLETED"] as const;
export type StageCode = (typeof STAGES)[number];

export const MILESTONE_CODES = ["DC1", "DC2", "DC3", "DC4", "DEGREE"] as const;
export type MilestoneCode = (typeof MILESTONE_CODES)[number];

export function isMilestoneCode(code: string): code is MilestoneCode {
  return (MILESTONE_CODES as readonly string[]).includes(code);
}

/** Stage that follows `code` in the journey, or null at the end. */
export function nextStage(code: string): StageCode | null {
  const i = STAGES.indexOf(code as StageCode);
  if (i === -1 || i === STAGES.length - 1) return null;
  return STAGES[i + 1];
}

/** Milestone that must be MEETING_COMPLETED before `code` can be opened (null for DC1). */
export function previousMilestone(code: MilestoneCode): MilestoneCode | null {
  const i = MILESTONE_CODES.indexOf(code);
  return i > 0 ? MILESTONE_CODES[i - 1] : null;
}

export const DOC_TYPE_LABELS: Record<string, string> = {
  fee_receipt: "Fee Receipt",
  marksheet: "Marksheet",
  dc1_report: "DC1 Report",
  paper_published_report: "Published Paper Report",
  dc2_report: "DC2 Report",
  thesis_evaluation_report: "Thesis Evaluation Report",
  dc4_report: "DC4 Report",
};

export const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted — awaiting Supervisor",
  SUPERVISOR_APPROVED: "Supervisor approved — awaiting R&D",
  SUPERVISOR_REJECTED: "Rejected by Supervisor",
  RND_APPROVED: "R&D approved — awaiting meeting",
  RND_REJECTED: "Rejected by R&D",
  MEETING_COMPLETED: "Meeting completed",
  DEGREE_ISSUED: "Degree issued",
};

/** Statuses in which the student may edit documents and (re)submit. */
export const EDITABLE_STATUSES = ["DRAFT", "SUPERVISOR_REJECTED", "RND_REJECTED"] as const;

export function isEditableStatus(status: string): boolean {
  return (EDITABLE_STATUSES as readonly string[]).includes(status);
}

export const ALLOWED_UPLOAD_TYPES = ["application/pdf", "image/jpeg", "image/png"];
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB
