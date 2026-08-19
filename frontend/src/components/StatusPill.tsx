const CONFIG: Record<string, { label: string; className: string }> = {
  pendiente: { label: "Pendiente", className: "text-stamp-pendiente" },
  pendiente_validacion: { label: "Validando", className: "text-stamp-validando" },
  aprobado: { label: "Aprobado", className: "text-stamp-aprobado" },
  rechazado: { label: "Rechazado", className: "text-stamp-rechazado" },
};

export function StatusPill({ estado }: { estado: string }) {
  const cfg = CONFIG[estado] ?? { label: estado, className: "text-muted" };
  return <span className={`stamp ${cfg.className}`}>{cfg.label}</span>;
}
