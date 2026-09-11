import { useEffect, useMemo, useState } from "react";
import { Download, ChevronDown, ChevronLeft, ChevronRight, Tag, CalendarClock, Search, Pencil, Ban, Wallet } from "lucide-react";
import { api, apiUrl, ApiError } from "../lib/api";
import type { Gasto } from "../lib/types";
import { CATEGORIA_LABEL, TIPO_COMPROBANTE_LABEL } from "../lib/types";
import { StatusPill } from "../components/StatusPill";
import { ReceiptViewer } from "../components/ReceiptViewer";
import { EditarGasto } from "../components/EditarGasto";
import { Modal } from "../components/Modal";
import { relativeDate, normalizeSearch } from "../lib/format";
import { useAuth } from "../lib/auth";

const ESTADOS = ["pendiente", "pendiente_validacion", "aprobado", "pagado", "rechazado", "anulado"] as const;
const ESTADO_LABEL: Record<string, string> = {
  pendiente: "Pendiente",
  pendiente_validacion: "Validando",
  aprobado: "Aprobado",
  pagado: "Pagado",
  rechazado: "Rechazado",
  anulado: "Anulado",
};

// Un gasto pagado o anulado ya está cerrado; el backend rechaza editarlo, así que no se ofrece.
const EDITABLES = ["pendiente", "pendiente_validacion", "aprobado", "rechazado"];

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
  const [version, setVersion] = useState(0);
  const [editando, setEditando] = useState<Gasto | null>(null);
  const [anulando, setAnulando] = useState<Gasto | null>(null);
  const [motivo, setMotivo] = useState("");
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");

  const recargar = () => setVersion((v) => v + 1);

  useEffect(() => {
    const qs = new URLSearchParams();
    if (estado) qs.set("estado", estado);
    if (categoria) qs.set("categoria", categoria);
    setGastos(null);
    api.get<Gasto[]>(`/gastos?${qs.toString()}`).then(setGastos);
  }, [estado, categoria, version]);

  useEffect(() => setPage(1), [estado, categoria, search]);
  // La selección es de la vista actual: al cambiar de filtro esos ids ya no están en pantalla y
  // marcarlos como pagados sería un pago a ciegas.
  useEffect(() => setSeleccion(new Set()), [estado, categoria, search, version]);

  const filtered = useMemo(() => {
    if (!gastos) return null;
    if (!search.trim()) return gastos;
    const q = normalizeSearch(search.trim());
    return gastos.filter((g) =>
      [g.usuario.nombre, g.razonSocialEmisor, g.numeroComprobante, g.rucEmisor]
        .filter(Boolean)
        .some((field) => normalizeSearch(field!).includes(q)),
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

  const esAdmin = user?.rol === "admin";
  // El cobro se hace en lote y sobre lo aprobado, así que las casillas aparecen solo ahí:
  // ofrecerlas en "todos los estados" invita a marcar como pagado algo que nadie aprobó.
  const puedePagarLote = esAdmin && estado === "aprobado";

  async function anular() {
    if (!anulando) return;
    setError("");
    try {
      await api.post(`/gastos/${anulando.id}/anular`, { motivo });
      setAnulando(null);
      setMotivo("");
      recargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo anular");
    }
  }

  async function marcarPagados() {
    setError("");
    try {
      const res = await api.post<{ pagados: number; omitidos: number }>("/gastos/pagar", { ids: [...seleccion] });
      if (res.omitidos > 0) setError(`${res.pagados} marcados como pagados. ${res.omitidos} se omitieron porque ya no estaban aprobados.`);
      recargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo registrar el pago");
    }
  }

  function alternar(id: string) {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const totalSeleccionado = useMemo(
    () => (filtered ?? []).filter((g) => seleccion.has(g.id)).reduce((sum, g) => sum + Number(g.monto), 0),
    [filtered, seleccion],
  );

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

      {error && <p className="border-b border-ink/8 py-3 text-sm text-stamp-rechazado">{error}</p>}

      {editando && <EditarGasto gasto={editando} onClose={() => setEditando(null)} onSaved={recargar} />}

      {anulando && (
        <Modal title="Anular gasto" onClose={() => { setAnulando(null); setMotivo(""); }}>
          <p className="mb-3 text-sm text-muted">
            El gasto no se borra: queda registrado como anulado, con tu nombre y este motivo. Un
            contador que revise la rendición dentro de seis meses va a leer justamente esto.
          </p>
          <input
            autoFocus
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej: cargado dos veces por error"
            className="w-full rounded-md border border-ink/12 bg-page px-3 py-2 text-sm"
          />
          <button
            onClick={anular}
            disabled={motivo.trim().length < 3}
            className="mt-3 w-full rounded-md bg-stamp-rechazado px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Anular gasto
          </button>
        </Modal>
      )}

      {puedePagarLote && seleccion.size > 0 && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-ink/8 bg-surface py-3">
          <p className="text-sm text-ink">
            <span className="font-semibold">{seleccion.size}</span> seleccionados ·{" "}
            <span className="font-semibold tabular-nums">S/ {totalSeleccionado.toFixed(2)}</span>
          </p>
          <button
            onClick={marcarPagados}
            className="flex items-center gap-2 rounded-md bg-stamp-pagado px-4 py-2 text-sm font-semibold text-white"
          >
            <Wallet size={15} /> Marcar como pagados
          </button>
        </div>
      )}

      {!gastos ? (
        <p className="pt-6 text-sm text-muted">Cargando...</p>
      ) : (
      <div className="pt-6">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink/8 text-xs text-muted">
                {puedePagarLote && (
                  <th className="w-8 py-2">
                    <input
                      type="checkbox"
                      aria-label="Seleccionar todos"
                      checked={pageItems.length > 0 && pageItems.every((g) => seleccion.has(g.id))}
                      onChange={(e) =>
                        setSeleccion((prev) => {
                          const next = new Set(prev);
                          pageItems.forEach((g) => (e.target.checked ? next.add(g.id) : next.delete(g.id)));
                          return next;
                        })
                      }
                    />
                  </th>
                )}
                <th className="py-2 pr-4 font-medium">Colaborador</th>
                <th className="py-2 pr-4 font-medium">Proveedor</th>
                <th className="py-2 pr-4 font-medium">Categoría</th>
                <th className="py-2 pr-4 font-medium">Comprobante</th>
                <th className="py-2 pr-4 font-medium">Estado</th>
                <th className="py-2 pr-4 font-medium">Monto</th>
                <th className="py-2 pr-4 font-medium">Fecha</th>
                <th className="w-8 py-2" />
                <th className="py-2 pr-0 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((g) => (
                <tr key={g.id} className="border-b border-ink/6 last:border-0">
                  {puedePagarLote && (
                    <td className="py-3">
                      <input
                        type="checkbox"
                        aria-label={`Seleccionar gasto de ${g.usuario.nombre}`}
                        checked={seleccion.has(g.id)}
                        onChange={() => alternar(g.id)}
                      />
                    </td>
                  )}
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
                  <td className="py-3 pr-4 text-muted">{TIPO_COMPROBANTE_LABEL[g.tipoComprobante]}</td>
                  <td className="py-3 pr-4">
                    <StatusPill estado={g.estado} />
                    {g.motivoAnulacion && <span className="block text-xs text-muted">{g.motivoAnulacion}</span>}
                    {g.observacionSunat && <span className="block text-xs text-stamp-rechazado">{g.observacionSunat}</span>}
                  </td>
                  <td className="py-3 pr-4 font-medium tabular-nums text-ink">S/ {Number(g.monto).toFixed(2)}</td>
                  <td className="py-3 pr-4 text-muted">{relativeDate(g.fechaGasto)}</td>
                  <td className="py-3">
                    <ReceiptViewer url={g.imagenUrl} />
                  </td>
                  <td className="py-3 pr-0">
                    <div className="flex items-center justify-end gap-1">
                      {EDITABLES.includes(g.estado) && (
                        <button
                          onClick={() => setEditando(g)}
                          title="Corregir"
                          className="rounded-md px-2 py-1.5 text-muted hover:text-ink"
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                      {esAdmin && g.estado !== "anulado" && g.estado !== "pagado" && (
                        <button
                          onClick={() => setAnulando(g)}
                          title="Anular"
                          className="rounded-md px-2 py-1.5 text-muted hover:text-stamp-rechazado"
                        >
                          <Ban size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered?.length === 0 && (
                <tr>
                  <td colSpan={puedePagarLote ? 10 : 9} className="py-10 text-center text-muted">
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
