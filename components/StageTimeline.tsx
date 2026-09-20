import Link from "next/link";
import { Check, ChevronRight, Lock } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";

export type TimelineStage = {
  code: string;
  label: string;
  status: string; // ApplicationStatus, LOCKED, NOT_STARTED, or a SupervisorRequestStatus
  statusLabel?: string;
  href?: string;
  done: boolean;
};

/**
 * The scholar's journey as a bordered list: one row per stage with its number,
 * name, current state and a link when the stage is open.
 */
export default function StageTimeline({ stages }: { stages: TimelineStage[] }) {
  const doneCount = stages.filter((s) => s.done).length;
  const pct = Math.round((doneCount / stages.length) * 100);

  return (
    <div className="box">
      <div className="box-header">
        <h2 className="box-title">Journey</h2>
        <div className="flex items-center gap-3 text-xs text-muted">
          <span>
            {doneCount} of {stages.length} stages complete
          </span>
          <span className="h-1.5 w-28 overflow-hidden rounded-full bg-elevated" aria-hidden>
            <span className="block h-full rounded-full bg-success" style={{ width: `${pct}%` }} />
          </span>
        </div>
      </div>
      <ol>
        {stages.map((s, i) => {
          const locked = s.status === "LOCKED";
          const row = (
            <div
              className={`flex items-center gap-4 px-4 py-3 ${
                locked ? "opacity-60" : s.href ? "transition-colors hover:bg-elevated" : ""
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums ${
                  s.done
                    ? "bg-success text-white"
                    : locked
                      ? "bg-elevated text-faint"
                      : "bg-accent/15 text-accent ring-1 ring-inset ring-accent/40"
                }`}
                aria-hidden
              >
                {s.done ? <Check size={14} /> : locked ? <Lock size={12} /> : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className={`text-sm font-semibold ${locked ? "text-muted" : ""}`}>{s.label}</span>
                  <span className="mono text-[11px] uppercase text-faint">{s.code}</span>
                </div>
              </div>
              <StatusBadge status={s.status} label={s.statusLabel} />
              {s.href ? <ChevronRight size={16} className="shrink-0 text-faint" /> : <span className="w-4" />}
            </div>
          );
          return (
            <li key={s.code} className="border-b border-line last:border-b-0">
              {s.href ? (
                <Link href={s.href} className="block">
                  {row}
                </Link>
              ) : (
                row
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
