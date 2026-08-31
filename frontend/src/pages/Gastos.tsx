import { useEffect, useMemo, useState } from "react";
import { Download, ChevronDown, ChevronLeft, ChevronRight, Tag, CalendarClock, Search } from "lucide-react";
import { api, apiUrl } from "../lib/api";
import type { Gasto } from "../lib/types";
import { CATEGORIA_LABEL } from "../lib/types";
import { StatusPill } from "../components/StatusPill";
import { ReceiptViewer } from "../components/ReceiptViewer";
import { relativeDate } from "../lib/format";
import { useAuth } from "../lib/auth";

const ESTADOS = ["pendiente", "pendiente_validacion", "aprobado", "rechazado"] as const;
const ESTADO_LABEL: Record<string, string> = {
  pendiente: "Pendiente",
  pendiente_validacion: "Validando",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
};

const PAGE_SIZE = 12;

function FilterSelect({
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
    <div className="relative">
      <Icon size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-md border border-ink/15 bg-surface py-2.5 pl-8 pr-8 text-sm font-medium text-ink outline-none"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted" />
    </div>
  );
}

export function Gastos() {
  const { user } = useAuth();
  const [gastos, setGastos] = useState<Gasto[] | null>(null);
  const [estado, setEstado] = useState("");
  const [categoria, setCategoria] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const qs = new URLSearchParams();
    if (estado) qs.set("estado", estado);
    if (categoria) qs.set("categoria", categoria);
    setGastos(null);
    api.get<Gasto[]>(`/gastos?${qs.toString()}`).then(setGastos);
  }, [estado, categoria]);

  useEffect(() => setPage(1), [estado, categoria, search]);

  const filtered = useMemo(() => {
    if (!gastos) return null;
    if (!search.trim()) return gastos;
    const q = search.trim().toLowerCase();
    return gastos.filter((g) =>
      [g.usuario.nombre, g.razonSocialEmisor, g.numeroComprobante, g.rucEmisor]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(q)),
    );
  }, [gastos, search]);

  const token = localStorage.getItem("gastify_token") ?? "";

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

  const totalPages = Math.max(1, Math.ceil((filtered?.length ?? 0) / PAGE_SIZE));
  const pageItems = useMemo(() => {
    if (!filtered) return [];
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  return (
    <div className="flex flex-col">
      <div className="flex flex-col justify-between gap-4 border-b border-ink/8 pb-6 sm:flex-row sm:items-start">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            {user?.rol === "empleado" ? "Mis gastos" : "Gastos"}
          </h1>
          <p className="mt-1 text-sm text-muted">Filtra por estado o categoría.</p>
        </div>
        {user?.rol !== "empleado" && (
          <button
            onClick={exportCsv}
            className="flex items-center justify-center gap-2 rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
          >
            <Download size={16} /> Exportar CSV
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2.5 border-b border-ink/8 py-6">
        <FilterSelect
          icon={CalendarClock}
          value={estado}
          onChange={setEstado}
          placeholder="Todos los estados"
          options={ESTADOS.map((e) => ({ value: e, label: ESTADO_LABEL[e] }))}
        />
        <FilterSelect
          icon={Tag}
          value={categoria}
          onChange={setCategoria}
          placeholder="Todas las categorías"
          options={Object.entries(CATEGORIA_LABEL).map(([value, label]) => ({ value, label }))}
        />
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por proveedor, comprobante, RUC o colaborador..."
            className="w-full rounded-md border border-ink/15 bg-page py-2.5 pl-8 pr-3 text-sm outline-none focus:border-brand sm:w-72"
          />
        </div>
      </div>

      {!gastos ? (
        <p className="pt-6 text-sm text-muted">Cargando...</p>
      ) : (
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
                <th className="py-2 pr-4 font-medium">Fecha</th>
                <th className="w-8 py-2" />
              </tr>
            </thead>
            <tbody>
              {pageItems.map((g) => (
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
                  <td className="py-3 pr-4 text-muted">{relativeDate(g.fechaGasto)}</td>
                  <td className="py-3">
                    <ReceiptViewer url={g.imagenUrl} />
                  </td>
                </tr>
              ))}
              {filtered?.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-muted">
                    No hay gastos con estos filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filtered && filtered.length > PAGE_SIZE && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <p className="text-muted">
              Página {page} de {totalPages} · {filtered.length} gastos
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-ink/12 text-ink disabled:opacity-30"
                aria-label="Página anterior"
              >
                <ChevronLeft size={15} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-ink/12 text-ink disabled:opacity-30"
                aria-label="Página siguiente"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
