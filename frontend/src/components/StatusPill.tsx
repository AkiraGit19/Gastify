const CONFIG: Record<string, { label: string; className: string }> = {
  pendiente: { label: "Pendiente", className: "bg-warning-soft text-warning" },
  pendiente_validacion: { label: "Validando", className: "bg-brand-soft text-brand" },
  aprobado: { label: "Aprobado", className: "bg-success-soft text-success" },
  rechazado: { label: "Rechazado", className: "bg-danger-soft text-danger" },
};

export function StatusPill({ estado }: { estado: string }) {
  const cfg = CONFIG[estado] ?? { label: estado, className: "bg-page text-muted" };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${cfg.className}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {cfg.label}
    </span>
  );
}
