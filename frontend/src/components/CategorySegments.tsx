export interface Segment {
  label: string;
  value: number;
  color: string;
}

export function CategorySegments({ data }: { data: Segment[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0) || 1;

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {data.map((d) => (
          <div key={d.label} className="border-l-[3px] pl-3" style={{ borderColor: d.color }}>
            <p className="text-sm font-semibold tabular-nums text-ink">
              S/ {d.value.toLocaleString("es-PE", { maximumFractionDigits: 0 })}{" "}
              <span className="text-xs font-normal tabular-nums text-muted">{((d.value / total) * 100).toFixed(1)}%</span>
            </p>
            <p className="mt-0.5 text-xs text-muted">{d.label}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex h-3.5 w-full overflow-hidden rounded-full bg-page">
        {data.map((d) => (
          <div key={d.label} style={{ width: `${(d.value / total) * 100}%`, backgroundColor: d.color }} />
        ))}
      </div>
    </div>
  );
}
