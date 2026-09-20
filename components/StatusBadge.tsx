import {
  CircleDashed,
  CircleDot,
  Clock,
  FileEdit,
  Lock,
  Send,
  ShieldCheck,
  ThumbsUp,
  Trophy,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { STATUS_LABELS } from "@/lib/milestones";

type Tone = "neutral" | "accent" | "success" | "danger" | "attention" | "done" | "faint";
type Style = { tone: Tone; icon: LucideIcon };

const TONES: Record<Tone, string> = {
  neutral: "border-line bg-elevated text-fg",
  accent: "border-accent/40 bg-accent/10 text-accent",
  success: "border-success/40 bg-success/10 text-success",
  danger: "border-danger/40 bg-danger/10 text-danger",
  attention: "border-attention/40 bg-attention/10 text-attention",
  done: "border-done/40 bg-done/10 text-done",
  faint: "border-line bg-transparent text-faint",
};

const STYLES: Record<string, Style> = {
  DRAFT: { tone: "neutral", icon: FileEdit },
  SUBMITTED: { tone: "accent", icon: Send },
  SUPERVISOR_APPROVED: { tone: "accent", icon: ThumbsUp },
  SUPERVISOR_REJECTED: { tone: "danger", icon: XCircle },
  RND_APPROVED: { tone: "done", icon: ShieldCheck },
  RND_REJECTED: { tone: "danger", icon: XCircle },
  MEETING_COMPLETED: { tone: "success", icon: ShieldCheck },
  DEGREE_ISSUED: { tone: "success", icon: Trophy },
  // stage-level pseudo statuses
  LOCKED: { tone: "faint", icon: Lock },
  NOT_STARTED: { tone: "attention", icon: CircleDashed },
  OPEN: { tone: "success", icon: CircleDot },
  PENDING: { tone: "attention", icon: Clock },
  ALLOCATED: { tone: "success", icon: ShieldCheck },
  NOT_REQUESTED: { tone: "neutral", icon: CircleDashed },
  STAGE: { tone: "neutral", icon: CircleDot },
};

const FALLBACK: Style = { tone: "neutral", icon: CircleDashed };

/** Square state label (GitHub issue/PR state style) for statuses and stages. */
export default function StatusBadge({ status, label }: { status: string; label?: string }) {
  const style = STYLES[status] ?? FALLBACK;
  const Icon = style.icon;
  return (
    <span className={`state ${TONES[style.tone]}`}>
      <Icon size={13} />
      {label ?? STATUS_LABELS[status] ?? status.replaceAll("_", " ")}
    </span>
  );
}
