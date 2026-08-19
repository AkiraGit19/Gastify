import { useEffect, useState } from "react";
import { Download, CalendarClock, Tag, ChevronDown, X } from "lucide-react";
import { api, apiUrl } from "../lib/api";
import type { Gasto } from "../lib/types";
import { CATEGORIA_LABEL } from "../lib/types";
import { ReceiptRow } from "../components/ReceiptRow";
import { useAuth } from "../lib/auth";

const ESTADOS = ["pendiente", "pendiente_validacion", "aprobado", "rechazado"] as const;
const ESTADO_LABEL: Record<string, string> = {
  pendiente: "Pendiente",
  pendiente_validacion: "Validando",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
};

function FilterChip({
  icon: Icon,
  value,
  onChange,
  options,
  placeholder,
}: {
  icon: typeof Tag;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  return (
    <div className="relative flex items-center rounded-full border border-ink/15 bg-surface pl-3 pr-7 text-xs">
      <Icon size={13} className="mr-1.5 shrink-0 text-muted" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-transparent py-2 font-mono uppercase tracking-wide text-ink outline-none"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown size={12} className="pointer-events-none absolute right-2.5 text-muted" />
    </div>
  );
}

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
  const hasFilters = Boolean(estado || categoria);

  async function exportCsv() {
    const qs = new URLSearchParams({ ...(estado ? { estado } : {}), ...(categoria ? { categoria } : {}) });
    const res = await fetch(apiUrl(`/gastos/export.csv?${qs}`), { headers: { Authorization: `Bearer ${token}` } });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "gastos.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
            {user?.rol === "empleado" ? "Mis gastos" : "Gastos"}
          </h1>
          <p className="text-sm text-muted">Filtra por estado o categoría.</p>
        </div>
        {user?.rol !== "empleado" && (
          <button
            onClick={exportCsv}
            className="flex items-center gap-2 rounded-md bg-rail px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
          >
            <Download size={16} /> Exportar CSV
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterChip
          icon={CalendarClock}
          value={estado}
          onChange={setEstado}
          placeholder="Todos los estados"
          options={ESTADOS.map((e) => ({ value: e, label: ESTADO_LABEL[e] }))}
        />
        <FilterChip
          icon={Tag}
          value={categoria}
          onChange={setCategoria}
          placeholder="Todas las categorías"
          options={Object.entries(CATEGORIA_LABEL).map(([value, label]) => ({ value, label }))}
        />
        {hasFilters && (
          <button
            onClick={() => {
              setEstado("");
              setCategoria("");
            }}
            className="flex items-center gap-1 rounded-full px-3 py-2 font-mono text-xs uppercase tracking-wide text-muted hover:text-ink"
          >
            <X size={12} /> Limpiar
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {gastos?.map((g) => (
          <ReceiptRow
            key={g.id}
            imagenUrl={g.imagenUrl}
            scanning={g.estado === "pendiente_validacion"}
            title={g.razonSocialEmisor ?? "Proveedor sin confirmar"}
            meta={`${g.usuario.nombre} · ${CATEGORIA_LABEL[g.categoria]} · ${new Date(g.fechaGasto).toLocaleDateString("es-PE")}`}
            amount={`S/ ${Number(g.monto).toFixed(2)}`}
            estado={g.estado}
          />
        ))}
        {gastos?.length === 0 && <p className="py-6 text-center text-sm text-muted">No hay gastos con estos filtros.</p>}
      </div>
    </div>
  );
}
