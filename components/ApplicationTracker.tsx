import { Check, X } from "lucide-react";
import { fmtDateTime } from "@/lib/format";

type App = {
  status: string;
  submittedAt: Date | null;
  supervisorReviewedAt: Date | null;
  supervisorRemarks: string | null;
  rndReviewedAt: Date | null;
  rndRemarks: string | null;
  meetingCompletedAt: Date | null;
  degreeIssuedAt: Date | null;
};

type StepState = "done" | "current" | "rejected" | "pending";
type Step = { label: string; state: StepState; detail?: string; remarks?: string | null };

const DOT: Record<StepState, string> = {
  done: "bg-success text-white",
  current: "bg-accent text-white",
  rejected: "bg-danger text-white",
  pending: "bg-elevated text-faint ring-1 ring-inset ring-line",
};

/** Vertical status tracker for one milestone application (PR-timeline style). */
export default function ApplicationTracker({ app, isDegree }: { app: App; isDegree: boolean }) {
  const s = app.status;

  const steps: Step[] = [
    s === "DRAFT"
      ? { label: "Application submitted", state: "current", detail: "Draft. Upload documents and submit." }
      : { label: "Application submitted", state: "done", detail: fmtDateTime(app.submittedAt) },

    s === "DRAFT" || s === "SUBMITTED"
      ? {
          label: "Supervisor review",
          state: s === "SUBMITTED" ? "current" : "pending",
          detail: s === "SUBMITTED" ? "Awaiting your supervisor's decision" : undefined,
        }
      : s === "SUPERVISOR_REJECTED"
        ? {
            label: "Supervisor review",
            state: "rejected",
            detail: `Returned on ${fmtDateTime(app.supervisorReviewedAt)}. Revise and resubmit.`,
            remarks: app.supervisorRemarks,
          }
        : { label: "Supervisor review", state: "done", detail: `Approved on ${fmtDateTime(app.supervisorReviewedAt)}` },

    ["DRAFT", "SUBMITTED", "SUPERVISOR_REJECTED"].includes(s)
      ? { label: "R&D section review", state: "pending" }
      : s === "SUPERVISOR_APPROVED"
        ? { label: "R&D section review", state: "current", detail: "Awaiting the R&D section's decision" }
        : s === "RND_REJECTED"
          ? {
              label: "R&D section review",
              state: "rejected",
              detail: `Returned on ${fmtDateTime(app.rndReviewedAt)}. Revise and resubmit.`,
              remarks: app.rndRemarks,
            }
          : { label: "R&D section review", state: "done", detail: `Approved on ${fmtDateTime(app.rndReviewedAt)}` },

    s === "MEETING_COMPLETED"
      ? { label: "DC meeting", state: "done", detail: `Completed on ${fmtDateTime(app.meetingCompletedAt)}` }
      : s === "DEGREE_ISSUED"
        ? { label: "Degree issued", state: "done", detail: fmtDateTime(app.degreeIssuedAt) }
        : {
            label: isDegree ? "Degree issuance" : "DC meeting",
            state: s === "RND_APPROVED" ? "current" : "pending",
            detail:
              s === "RND_APPROVED"
                ? isDegree
                  ? "Cleared. The R&D section will issue your degree."
                  : "Cleared for the meeting. R&D records completion afterwards."
                : undefined,
          },
  ];

  return (
    <ol>
      {steps.map((step, i) => (
        <li key={step.label} className="relative flex gap-3 pb-6 last:pb-0">
          {i < steps.length - 1 && <span className="absolute left-[11px] top-6 h-full w-px bg-line" aria-hidden />}
          <span
            className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${DOT[step.state]}`}
          >
            {step.state === "done" ? <Check size={13} /> : step.state === "rejected" ? <X size={13} /> : i + 1}
          </span>
          <div className="min-w-0 pt-0.5">
            <div className={`text-sm font-semibold ${step.state === "pending" ? "text-faint" : ""}`}>{step.label}</div>
            {step.detail && <div className="text-xs text-muted">{step.detail}</div>}
            {step.remarks && (
              <p className="mt-2 whitespace-pre-wrap rounded-lg border border-danger/25 bg-danger/[0.07] p-2.5 text-xs text-fg dark:bg-danger/[0.12]">
                {step.remarks}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
