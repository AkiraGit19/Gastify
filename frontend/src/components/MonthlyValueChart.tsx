import { useState } from "react";
import { money } from "../lib/format";

export interface MonthlyPoint {
  label: string;
  aprobado: number;
  total: number;
}

export function MonthlyValueChart({ data }: { data: MonthlyPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => Math.max(d.aprobado, d.total)), 1);
  const gridLines = [1, 0.5, 0];
  const active = hover !== null ? data[hover] : null;

  return (
    <div className="relative">
      {active && (
        <div
          className="pointer-events-none absolute top-0 z-10 w-52 rounded-lg border border-ink/10 bg-surface p-3 shadow-lg"
          style={{
            left: `${((hover as number) + 0.5) * (100 / data.length)}%`,
            transform: "translateX(-50%)",
          }}
        >
          <p className="mb-1.5 text-xs font-semibold capitalize text-ink">{active.label}</p>
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-muted">
              <span className="h-2 w-2 rounded-full bg-brand" /> Aprobado
            </span>
            <span className="font-medium tabular-nums text-ink">{money(active.aprobado)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-muted">
              <span className="h-2 w-2 rounded-full bg-brand-soft ring-1 ring-brand/40" /> Total registrado
            </span>
            <span className="font-medium tabular-nums text-ink">{money(active.total)}</span>
          </div>
        </div>
      )}

      <div className="flex h-44 gap-6 pl-12">
        <div className="flex h-full flex-col justify-between py-0.5 text-right text-[10px] tabular-nums text-muted">
          {gridLines.map((t) => (
            <span key={t} className="-ml-12 w-10">
              {money(Math.round(max * t))}
            </span>
          ))}
        </div>
        <div className="relative flex flex-1 gap-1.5 border-l border-ink/8">
          {gridLines.map((t) => (
            <div key={t} className="absolute left-0 right-0 border-t border-ink/8" style={{ bottom: `${t * 100}%` }} />
          ))}
          {data.map((d, i) => (
            <div
              key={d.label}
              className="group relative flex flex-1 items-end justify-center gap-1"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <div
                className="w-full max-w-[13px] rounded-t-[3px] bg-brand-soft transition-opacity group-hover:opacity-80"
                style={{ height: `${Math.max((d.total / max) * 100, d.total > 0 ? 2 : 0)}%` }}
              />
              <div
                className="w-full max-w-[13px] rounded-t-[3px] bg-brand transition-opacity group-hover:opacity-80"
                style={{ height: `${Math.max((d.aprobado / max) * 100, d.aprobado > 0 ? 2 : 0)}%` }}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-1.5 flex justify-between pl-[68px] text-[10px] capitalize text-muted">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}
