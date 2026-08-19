import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  icon: Icon,
  label,
  value,
  sublabel,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  sublabel: string;
}) {
  return (
    <div className="receipt-card flex items-start justify-between p-5">
      <div>
        <p className="mb-2 text-xs text-muted">{label}</p>
        <p className="font-mono text-2xl font-semibold text-ink">{value}</p>
        <p className="mt-1 text-xs text-muted">{sublabel}</p>
      </div>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
        <Icon size={17} strokeWidth={2} />
      </div>
    </div>
  );
}
