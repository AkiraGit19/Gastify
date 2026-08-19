import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { api, apiUrl } from "../lib/api";
import type { Gasto } from "../lib/types";
import { CATEGORIA_LABEL } from "../lib/types";
import { StatusPill } from "../components/StatusPill";
import { ReceiptThumb } from "../components/ReceiptThumb";
import { useAuth } from "../lib/auth";

const ESTADOS = ["pendiente", "pendiente_validacion", "aprobado", "rechazado"] as const;

export function Gastos() {
  const { user } = useAuth();
  const [gastos, setGastos] = useState<Gasto[] | null>(null);
  const [estado, setEstado] = useState("");
  const [categoria, setCategoria] = useState("");

  useEffect(() => {
    const qs = new URLSearchParams();
    if (estado) qs.set("estado", estado);
    if (categoria) qs.set("categoria", categoria);
    api.get<Gasto[]>(`/gastos?${qs.toString()}`).then(setGastos);
  }, [estado, categoria]);

  const token = localStorage.getItem("gastify_token") ?? "";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">{user?.rol === "empleado" ? "Mis gastos" : "Gastos"}</h1>
          <p className="text-sm text-muted">Filtra por estado o categoría.</p>
        </div>
        {user?.rol !== "empleado" && (
          <button
            onClick={async () => {
              const qs = new URLSearchParams({ ...(estado ? { estado } : {}), ...(categoria ? { categoria } : {}) });
              const res = await fetch(apiUrl(`/gastos/export.csv?${qs}`), { headers: { Authorization: `Bearer ${token}` } });
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "gastos.csv";
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
          >
            <Download size={16} /> Exportar CSV
          </button>
        )}
      </div>

      <div className="flex gap-3">
        <select value={estado} onChange={(e) => setEstado(e.target.value)} className="rounded-lg border border-brand-soft bg-surface px-3 py-2 text-sm text-ink">
          <option value="">Todos los estados</option>
          {ESTADOS.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="rounded-lg border border-brand-soft bg-surface px-3 py-2 text-sm text-ink">
          <option value="">Todas las categorías</option>
          {Object.entries(CATEGORIA_LABEL).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <div className="rounded-2xl bg-surface shadow-sm shadow-ink/5">
        <div className="flex flex-col divide-y divide-page px-6">
          {gastos?.map((g) => (
            <div key={g.id} className="flex items-center gap-4 py-3">
              <ReceiptThumb url={g.imagenUrl} scanning={g.estado === "pendiente_validacion"} />
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-ink">{g.razonSocialEmisor ?? "Proveedor sin confirmar"}</p>
                <p className="text-xs text-muted">
                  {g.usuario.nombre} · {CATEGORIA_LABEL[g.categoria]} · {new Date(g.fechaGasto).toLocaleDateString("es-PE")}
                </p>
              </div>
              <p className="font-mono text-sm font-medium text-ink">S/ {Number(g.monto).toFixed(2)}</p>
              <StatusPill estado={g.estado} />
            </div>
          ))}
          {gastos?.length === 0 && <p className="py-6 text-center text-sm text-muted">No hay gastos con estos filtros.</p>}
        </div>
      </div>
    </div>
  );
}
