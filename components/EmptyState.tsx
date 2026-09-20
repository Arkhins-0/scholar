import type { LucideIcon } from "lucide-react";

/** Primer-style "blankslate" for empty lists and queues. */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="blankslate">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-elevated text-muted">
        <Icon size={20} />
      </span>
      <h3 className="mt-1 text-sm font-semibold">{title}</h3>
      {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
