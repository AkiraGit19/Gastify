import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { api, ApiError } from "../lib/api";
import type { Gasto } from "../lib/types";
import { CATEGORIA_LABEL } from "../lib/types";
import { StatusPill } from "../components/StatusPill";
import { ReceiptViewer } from "../components/ReceiptViewer";

export function Aprobaciones() {
  const [gastos, setGastos] = useState<Gasto[] | null>(null);
  const [error, setError] = useState("");

  function load() {
    // Include pendiente_validacion too: SUNAT being unreachable must never block a human decision
    // (spec section 4.3) — without this, a gasto that never validates could never be approved.
    api.get<Gasto[]>("/gastos").then((all) =>
      setGastos(all.filter((g) => g.estado === "pendiente" || g.estado === "pendiente_validacion")),
    );
  }

  useEffect(load, []);

  async function decide(id: string, decision: boolean) {
    setError("");
    try {
      await api.post(`/gastos/${id}/decision`, { decision });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo registrar la decisión");
    }
  }

  return (
    <div className="flex flex-col">
      <div className="border-b border-ink/8 pb-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Aprobaciones pendientes</h1>
        <p className="mt-1 text-sm text-muted">Revisa y decide sobre los gastos de tu equipo.</p>
      </div>

      {error && <p className="border-b border-ink/8 py-3 text-sm text-stamp-rechazado">{error}</p>}

      <div className="pt-6">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink/8 text-xs text-muted">
                <th className="py-2 pr-4 font-medium">Colaborador</th>
                <th className="py-2 pr-4 font-medium">Proveedor</th>
                <th className="py-2 pr-4 font-medium">Categoría</th>
                <th className="py-2 pr-4 font-medium">Estado</th>
                <th className="py-2 pr-4 font-medium">Monto</th>
                <th className="w-8 py-2" />
                <th className="py-2 pr-0 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {gastos?.map((g) => (
                <tr key={g.id} className="border-b border-ink/6 last:border-0">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand">
                        {g.usuario.nombre.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-ink">{g.usuario.nombre}</span>
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-muted">{g.razonSocialEmisor ?? "Sin confirmar"}</td>
                  <td className="py-3 pr-4 text-muted">{CATEGORIA_LABEL[g.categoria]}</td>
                  <td className="py-3 pr-4">
                    <StatusPill estado={g.estado} />
                  </td>
                  <td className="py-3 pr-4 font-medium tabular-nums text-ink">S/ {Number(g.monto).toFixed(2)}</td>
                  <td className="py-3 pr-4">
                    <ReceiptViewer url={g.imagenUrl} />
                  </td>
                  <td className="py-3 pr-0">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => decide(g.id, true)}
                        className="flex items-center gap-1.5 rounded-md border border-stamp-aprobado/30 px-3 py-1.5 text-xs font-semibold text-stamp-aprobado transition-transform hover:scale-[1.03]"
                      >
                        <Check size={14} /> Aprobar
                      </button>
                      <button
                        onClick={() => decide(g.id, false)}
                        className="flex items-center gap-1.5 rounded-md border border-stamp-rechazado/30 px-3 py-1.5 text-xs font-semibold text-stamp-rechazado transition-transform hover:scale-[1.03]"
                      >
                        <X size={14} /> Rechazar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {gastos?.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-muted">
                    No hay gastos pendientes de aprobación.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
