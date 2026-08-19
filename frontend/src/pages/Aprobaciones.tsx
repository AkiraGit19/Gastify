import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { api } from "../lib/api";
import type { Gasto } from "../lib/types";
import { CATEGORIA_LABEL } from "../lib/types";
import { ReceiptThumb } from "../components/ReceiptThumb";

export function Aprobaciones() {
  const [gastos, setGastos] = useState<Gasto[] | null>(null);

  function load() {
    api.get<Gasto[]>("/gastos?estado=pendiente").then(setGastos);
  }

  useEffect(load, []);

  async function decide(id: string, decision: boolean) {
    await api.post(`/gastos/${id}/decision`, { decision });
    load();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Aprobaciones pendientes</h1>
        <p className="text-sm text-muted">Revisa y decide sobre los gastos de tu equipo.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {gastos?.map((g) => (
          <div key={g.id} className="flex flex-col gap-3 rounded-2xl bg-surface p-4 shadow-sm shadow-ink/5">
            <div className="flex items-center gap-3">
              <ReceiptThumb url={g.imagenUrl} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{g.razonSocialEmisor ?? "Proveedor sin confirmar"}</p>
                <p className="text-xs text-muted">{g.usuario.nombre}</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">{CATEGORIA_LABEL[g.categoria]}</span>
              <span className="font-mono font-semibold text-ink">S/ {Number(g.monto).toFixed(2)}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => decide(g.id, true)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-success-soft py-2 text-sm font-semibold text-success transition-transform hover:scale-[1.02]"
              >
                <Check size={16} /> Aprobar
              </button>
              <button
                onClick={() => decide(g.id, false)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-danger-soft py-2 text-sm font-semibold text-danger transition-transform hover:scale-[1.02]"
              >
                <X size={16} /> Rechazar
              </button>
            </div>
          </div>
        ))}
        {gastos?.length === 0 && <p className="text-sm text-muted">No hay gastos pendientes de aprobación.</p>}
      </div>
    </div>
  );
}
