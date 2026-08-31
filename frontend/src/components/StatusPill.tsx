export const ESTADO_CONFIG: Record<string, { label: string; color: string }> = {
  pendiente: { label: "Pendiente", color: "var(--color-stamp-pendiente)" },
  pendiente_validacion: { label: "Validando", color: "var(--color-stamp-validando)" },
  aprobado: { label: "Aprobado", color: "var(--color-stamp-aprobado)" },
  rechazado: { label: "Rechazado", color: "var(--color-stamp-rechazado)" },
};

export function StatusPill({ estado }: { estado: string }) {
  const cfg = ESTADO_CONFIG[estado] ?? { label: estado, color: "var(--color-muted)" };
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: cfg.color }} />
      {cfg.label}
    </span>
  );
}
