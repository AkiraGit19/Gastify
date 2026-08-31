import { Settings } from "lucide-react";

export function Configuracion() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Configuración</h1>
        <p className="text-sm text-muted">Ajustes de tu empresa y de tu cuenta.</p>
      </div>

      <div className="receipt-card flex flex-col items-center gap-3 px-6 py-16 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-brand">
          <Settings size={20} />
        </div>
        <p className="text-sm font-medium text-ink">Todavía no hay nada que configurar aquí</p>
        <p className="max-w-sm text-sm text-muted">
          Esta sección está reservada para más adelante — categorías, presupuestos y notificaciones por correo llegarán acá.
        </p>
      </div>
    </div>
  );
}
