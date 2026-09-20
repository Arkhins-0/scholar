import type { LucideIcon } from "lucide-react";

/** Page heading row: serif title, optional icon/subtitle, right-aligned actions, hairline below. */
export default function PageHeader({
  icon: Icon,
  title,
  subtitle,
  actions,
}: {
  icon?: LucideIcon;
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="pagehead">
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center border border-line bg-elevated text-muted">
            <Icon size={18} />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="display text-2xl leading-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
