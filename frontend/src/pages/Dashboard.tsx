import { useEffect, useState } from "react";
import { Clock, CheckCircle2, Wallet } from "lucide-react";
import { api } from "../lib/api";
import type { Gasto } from "../lib/types";
import { CATEGORIA_LABEL } from "../lib/types";
import { CountUp } from "../components/CountUp";
import { StatusPill } from "../components/StatusPill";
import { ReceiptThumb } from "../components/ReceiptThumb";
import { useAuth } from "../lib/auth";

export function Dashboard() {
  const { user } = useAuth();
  const [gastos, setGastos] = useState<Gasto[] | null>(null);

  useEffect(() => {
    api.get<Gasto[]>("/gastos").then(setGastos);
  }, []);

  if (!gastos) return <p className="text-sm text-muted">Cargando...</p>;

  const pendientes = gastos.filter((g) => g.estado === "pendiente" || g.estado === "pendiente_validacion").length;
  const aprobados = gastos.filter((g) => g.estado === "aprobado").length;
  const totalMonto = gastos.reduce((sum, g) => sum + Number(g.monto), 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">
          {user?.rol === "empleado" ? "Tus gastos" : "Resumen de gastos"}
        </h1>
        <p className="text-sm text-muted">Así está la rendición de gastos hoy.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={Clock} label="Pendientes" value={<CountUp value={pendientes} />} accent="warning" />
        <StatCard icon={CheckCircle2} label="Aprobados" value={<CountUp value={aprobados} />} accent="success" />
        <StatCard
          icon={Wallet}
          label="Monto total"
          value={<CountUp value={totalMonto} prefix="S/ " decimals={2} />}
          accent="brand"
        />
      </div>

      <div className="rounded-2xl bg-surface p-6 shadow-sm shadow-ink/5">
        <h2 className="mb-4 font-semibold text-ink">Últimos gastos</h2>
        <div className="flex flex-col divide-y divide-page">
          {gastos.slice(0, 8).map((g) => (
            <div key={g.id} className="flex items-center gap-4 py-3">
              <ReceiptThumb url={g.imagenUrl} scanning={g.estado === "pendiente_validacion"} />
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-ink">
                  {g.razonSocialEmisor ?? "Proveedor sin confirmar"}
                </p>
                <p className="text-xs text-muted">
                  {g.usuario.nombre} · {CATEGORIA_LABEL[g.categoria]} · {new Date(g.fechaGasto).toLocaleDateString("es-PE")}
                </p>
              </div>
              <p className="font-mono text-sm font-medium text-ink">S/ {Number(g.monto).toFixed(2)}</p>
              <StatusPill estado={g.estado} />
            </div>
          ))}
          {gastos.length === 0 && <p className="py-6 text-center text-sm text-muted">Todavía no hay gastos registrados.</p>}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Clock;
  label: string;
  value: React.ReactNode;
  accent: "warning" | "success" | "brand";
}) {
  const accentClass = { warning: "bg-warning-soft text-warning", success: "bg-success-soft text-success", brand: "bg-brand-soft text-brand" }[accent];
  return (
    <div className="rounded-2xl bg-surface p-5 shadow-sm shadow-ink/5 transition-transform hover:-translate-y-0.5">
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg ${accentClass}`}>
        <Icon size={18} />
      </div>
      <p className="text-sm text-muted">{label}</p>
      <p className="font-mono text-2xl font-semibold text-ink">{value}</p>
    </div>
  );
}
