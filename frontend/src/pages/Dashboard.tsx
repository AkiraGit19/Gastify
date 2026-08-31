import { useEffect, useMemo, useState } from "react";
import { Download, Search, Calendar, ChevronDown } from "lucide-react";
import { api, apiUrl } from "../lib/api";
import type { Gasto } from "../lib/types";
import { CATEGORIA_LABEL } from "../lib/types";
import { CountUp } from "../components/CountUp";
import { CategorySegments } from "../components/CategorySegments";
import { MonthlyValueChart } from "../components/MonthlyValueChart";
import { StatusPill } from "../components/StatusPill";
import { relativeDate } from "../lib/format";
import { useAuth } from "../lib/auth";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const CAT_COLORS = ["var(--color-cat-1)", "var(--color-cat-2)", "var(--color-cat-3)", "var(--color-cat-4)"];

const PERIODOS = [
  { value: "30", label: "Últimos 30 días" },
  { value: "90", label: "Últimos 90 días" },
  { value: "365", label: "Últimos 12 meses" },
  { value: "all", label: "Todo" },
];

function monthKey(dateStr: string) {
  const d = new Date(dateStr);
  return d.getFullYear() * 12 + d.getMonth();
}

function pctDelta(items: Gasto[]) {
  const now = new Date();
  const curKey = now.getFullYear() * 12 + now.getMonth();
  const sumFor = (key: number) => items.filter((g) => monthKey(g.fechaGasto) === key).reduce((s, g) => s + Number(g.monto), 0);
  const cur = sumFor(curKey);
  const prev = sumFor(curKey - 1);
  if (prev === 0) return null;
  return ((cur - prev) / prev) * 100;
}

function DeltaBadge({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const up = pct >= 0;
  return (
    <span className={up ? "text-stamp-aprobado" : "text-stamp-rechazado"}>
      {up ? "+" : ""}
      {pct.toFixed(0)}%
    </span>
  );
}

export function Dashboard() {
  const { user } = useAuth();
  const [gastosAll, setGastosAll] = useState<Gasto[] | null>(null);
  const [periodo, setPeriodo] = useState("30");
  const [tab, setTab] = useState<string>("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.get<Gasto[]>("/gastos").then(setGastosAll);
  }, []);

  const gastos = useMemo(() => {
    if (!gastosAll) return null;
    if (periodo === "all") return gastosAll;
    const days = Number(periodo);
    const cutoff = Date.now() - days * 86_400_000;
    return gastosAll.filter((g) => new Date(g.fechaGasto).getTime() >= cutoff);
  }, [gastosAll, periodo]);

  const monthly = useMemo(() => {
    if (!gastosAll) return [];
    const year = new Date().getFullYear();
    return MESES.map((label, i) => {
      const inMonth = gastosAll.filter((g) => {
        const d = new Date(g.fechaGasto);
        return d.getFullYear() === year && d.getMonth() === i;
      });
      return {
        label,
        total: inMonth.reduce((s, g) => s + Number(g.monto), 0),
        aprobado: inMonth.filter((g) => g.estado === "aprobado").reduce((s, g) => s + Number(g.monto), 0),
      };
    });
  }, [gastosAll]);

  const filteredTable = useMemo(() => {
    if (!gastos) return [];
    return gastos
      .filter((g) => (tab ? g.estado === tab : true))
      .filter((g) =>
        search
          ? `${g.usuario.nombre} ${g.razonSocialEmisor ?? ""}`.toLowerCase().includes(search.toLowerCase())
          : true,
      );
  }, [gastos, tab, search]);

  async function exportCsv() {
    const token = localStorage.getItem("gastify_token") ?? "";
    const qs = new URLSearchParams(tab ? { estado: tab } : {});
    const res = await fetch(apiUrl(`/gastos/export.csv?${qs}`), { headers: { Authorization: `Bearer ${token}` } });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "gastos.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!gastos) return <p className="text-sm text-muted">Cargando...</p>;

  const pendientes = gastos.filter((g) => g.estado === "pendiente" || g.estado === "pendiente_validacion");
  const aprobados = gastos.filter((g) => g.estado === "aprobado");
  const totalPendiente = pendientes.reduce((sum, g) => sum + Number(g.monto), 0);
  const totalAprobado = aprobados.reduce((sum, g) => sum + Number(g.monto), 0);
  const totalGeneral = gastos.reduce((sum, g) => sum + Number(g.monto), 0);

  const porCategoria = (Object.keys(CATEGORIA_LABEL) as (keyof typeof CATEGORIA_LABEL)[]).map((cat, i) => ({
    label: CATEGORIA_LABEL[cat],
    value: gastos.filter((g) => g.categoria === cat).reduce((sum, g) => sum + Number(g.monto), 0),
    color: CAT_COLORS[i % CAT_COLORS.length],
  }));

  const tabs = [
    { value: "", label: "Todos" },
    { value: "pendiente", label: "Pendiente" },
    { value: "pendiente_validacion", label: "Validando" },
    { value: "aprobado", label: "Aprobado" },
    { value: "rechazado", label: "Rechazado" },
  ];

  return (
    <div className="flex flex-col">
      <div className="flex flex-col justify-between gap-4 border-b border-ink/8 pb-6 sm:flex-row sm:items-start">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            {user?.rol === "empleado" ? "Tus gastos" : "Resumen de gastos"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {user?.nombre} · {user?.rol === "empleado" ? "Tu cuenta" : "Vista de empresa"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Calendar size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              className="appearance-none rounded-md border border-ink/15 bg-surface py-2.5 pl-8 pr-8 text-sm font-medium text-ink outline-none"
            >
              {PERIODOS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted" />
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
      </div>

      <div className="grid grid-cols-1 gap-6 border-b border-ink/8 py-6 sm:grid-cols-3">
        <div>
          <p className="mb-2 text-sm text-muted">Por aprobar ahora</p>
          <p className="text-2xl font-semibold tabular-nums text-ink">
            S/ <CountUp value={totalPendiente} decimals={2} />
          </p>
          <p className="mt-1 text-xs text-muted">
            <DeltaBadge pct={pctDelta(pendientes)} /> {pendientes.length} comprobante(s)
          </p>
        </div>
        <div>
          <p className="mb-2 text-sm text-muted">Aprobados</p>
          <p className="text-2xl font-semibold tabular-nums text-ink">
            S/ <CountUp value={totalAprobado} decimals={2} />
          </p>
          <p className="mt-1 text-xs text-muted">
            <DeltaBadge pct={pctDelta(aprobados)} /> {aprobados.length} comprobante(s)
          </p>
        </div>
        <div>
          <p className="mb-2 text-sm text-muted">Total registrado</p>
          <p className="text-2xl font-semibold tabular-nums text-ink">
            S/ <CountUp value={totalGeneral} decimals={2} />
          </p>
          <p className="mt-1 text-xs text-muted">
            <DeltaBadge pct={pctDelta(gastos)} /> {gastos.length} comprobante(s) en total
          </p>
        </div>
      </div>

      <div className="border-b border-ink/8 py-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-ink">Gastos por mes</h2>
          <div className="flex items-center gap-4 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-brand" /> Aprobado
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-brand-soft ring-1 ring-inset ring-brand/25" /> Total registrado
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
          <div className="shrink-0 sm:w-52">
            <p className="text-3xl font-semibold tabular-nums text-ink">
              S/ <CountUp value={totalGeneral} decimals={2} />
            </p>
            <p className="mt-1 text-xs text-muted">
              <DeltaBadge pct={pctDelta(gastos)} /> vs mes anterior
            </p>
          </div>
          <div className="min-w-0 flex-1">
            <MonthlyValueChart data={monthly} />
          </div>
        </div>
      </div>

      <div className="border-b border-ink/8 py-6">
        <h2 className="font-display mb-4 text-sm font-semibold text-ink">Gastos por categoría</h2>
        <CategorySegments data={porCategoria} />
      </div>

      <div className="pt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-4 text-sm">
            {tabs.map((t) => (
              <button
                key={t.value}
                onClick={() => setTab(t.value)}
                className={`border-b-2 pb-1 font-medium transition-colors ${
                  tab === t.value ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="w-full rounded-md border border-ink/15 bg-page py-2 pl-8 pr-3 text-sm outline-none focus:border-brand sm:w-56"
            />
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink/8 text-xs text-muted">
                <th className="py-2 pr-4 font-medium">Colaborador</th>
                <th className="py-2 pr-4 font-medium">Estado</th>
                <th className="py-2 pr-4 font-medium">Categoría</th>
                <th className="py-2 pr-4 font-medium">Monto</th>
                <th className="py-2 pr-4 font-medium">Actualizado</th>
              </tr>
            </thead>
            <tbody>
              {filteredTable.map((g) => (
                <tr key={g.id} className="border-b border-ink/6 last:border-0">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand">
                        {g.usuario.nombre.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink">{g.usuario.nombre}</p>
                        <p className="truncate text-xs text-muted">{g.razonSocialEmisor ?? "Proveedor sin confirmar"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <StatusPill estado={g.estado} />
                  </td>
                  <td className="py-3 pr-4 text-muted">{CATEGORIA_LABEL[g.categoria]}</td>
                  <td className="py-3 pr-4 font-medium tabular-nums text-ink">S/ {Number(g.monto).toFixed(2)}</td>
                  <td className="py-3 pr-4 text-muted">{relativeDate(g.fechaGasto)}</td>
                </tr>
              ))}
              {filteredTable.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-muted">
                    No hay gastos que coincidan.
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
