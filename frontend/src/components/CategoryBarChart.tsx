interface Bar {
  label: string;
  value: number;
}

const WIDTH = 560;
const HEIGHT = 160;
const PADDING_LEFT = 44;
const PADDING_TOP = 18;
const PADDING_BOTTOM = 24;
const PLOT_BOTTOM = HEIGHT - PADDING_BOTTOM;
const PLOT_H = PLOT_BOTTOM - PADDING_TOP;

export function CategoryBarChart({ data }: { data: Bar[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const plotWidth = WIDTH - PADDING_LEFT - 12;
  const barWidth = Math.min(56, plotWidth / data.length - 24);
  const step = plotWidth / data.length;
  const gridLines = [0, 0.5, 1];

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-40 w-full" role="img" aria-label="Gastos por categoría">
      {gridLines.map((t) => {
        const y = PLOT_BOTTOM - t * PLOT_H;
        return (
          <g key={t}>
            <line x1={PADDING_LEFT} y1={y} x2={WIDTH} y2={y} stroke="var(--color-ink)" strokeOpacity={0.08} strokeWidth={1} />
            <text x={PADDING_LEFT - 8} y={y + 3} textAnchor="end" fontSize={9} fontFamily="var(--font-mono)" fill="var(--color-muted)">
              {Math.round(max * t)}
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const barH = (d.value / max) * PLOT_H;
        const x = PADDING_LEFT + i * step + (step - barWidth) / 2;
        const y = PLOT_BOTTOM - barH;
        return (
          <g key={d.label}>
            <title>{`${d.label}: S/ ${d.value.toFixed(2)}`}</title>
            <rect x={x} y={y} width={barWidth} height={Math.max(barH, 2)} rx={4} fill="var(--color-brand)" />
            <text x={x + barWidth / 2} y={y - 6} textAnchor="middle" fontSize={10} fontFamily="var(--font-mono)" fontWeight={600} fill="var(--color-ink)">
              {d.value > 0 ? d.value.toFixed(0) : ""}
            </text>
            <text x={x + barWidth / 2} y={HEIGHT - 6} textAnchor="middle" fontSize={10} fill="var(--color-muted)">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
