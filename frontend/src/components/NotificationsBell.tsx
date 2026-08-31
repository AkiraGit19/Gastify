import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { api } from "../lib/api";
import type { Gasto } from "../lib/types";
import { relativeDate } from "../lib/format";
import { ESTADO_CONFIG } from "./StatusPill";
import { useAuth } from "../lib/auth";

interface Item {
  id: string;
  text: string;
  date: string;
  dot: string;
}

export function NotificationsBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    if (!user || user.rol === "super_admin") return;
    api.get<Gasto[]>("/gastos").then((gastos) => {
      const sorted = [...gastos].sort((a, b) => new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime());
      const list: Item[] =
        user.rol === "empleado"
          ? sorted.slice(0, 6).map((g) => ({
              id: g.id,
              text: `Tu gasto en ${g.razonSocialEmisor ?? "un proveedor"} está ${(ESTADO_CONFIG[g.estado]?.label ?? g.estado).toLowerCase()}`,
              date: g.fechaCreacion,
              dot: ESTADO_CONFIG[g.estado]?.color ?? "var(--color-muted)",
            }))
          : sorted
              .filter((g) => g.estado === "pendiente" || g.estado === "pendiente_validacion")
              .slice(0, 6)
              .map((g) => ({
                id: g.id,
                text: `${g.usuario.nombre} envió un comprobante de S/ ${Number(g.monto).toFixed(2)}`,
                date: g.fechaCreacion,
                dot: "var(--color-stamp-pendiente)",
              }));
      setItems(list);
    });
  }, [user]);

  if (!user || user.rol === "super_admin") {
    return (
      <span className="text-muted/40">
        <Bell size={18} strokeWidth={2} />
      </span>
    );
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="relative text-muted hover:text-ink" aria-label="Notificaciones">
        <Bell size={18} strokeWidth={2} />
        {items && items.length > 0 && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-stamp-rechazado" />}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-9 z-50 w-80 rounded-xl border border-ink/8 bg-surface p-2 shadow-xl">
            <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Notificaciones</p>
            <div className="flex max-h-80 flex-col overflow-y-auto">
              {items === null && <p className="px-2 py-4 text-center text-sm text-muted">Cargando...</p>}
              {items?.length === 0 && <p className="px-2 py-4 text-center text-sm text-muted">No hay notificaciones nuevas.</p>}
              {items?.map((it) => (
                <div key={it.id} className="flex items-start gap-2.5 rounded-lg px-2 py-2.5 hover:bg-page">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: it.dot }} />
                  <div className="min-w-0">
                    <p className="text-sm text-ink">{it.text}</p>
                    <p className="mt-0.5 text-xs text-muted">{relativeDate(it.date)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
