import { useEffect, useState } from "react";
import { Clock, CheckCircle2, Wallet } from "lucide-react";
import { api } from "../lib/api";
import type { Gasto } from "../lib/types";
import { CATEGORIA_LABEL } from "../lib/types";
import { CountUp } from "../components/CountUp";
import { ReceiptRow } from "../components/ReceiptRow";
import { CategoryBarChart } from "../components/CategoryBarChart";
import { useAuth } from "../lib/auth";

function StatCard({
  icon: Icon,
  label,
  value,
  sublabel,
}: {
  icon: typeof Clock;
  label: string;
  value: React.ReactNode;
  sublabel: string;
}) {
  return (
    <div className="receipt-card flex items-start justify-between p-5">
      <div>
        <p className="mb-2 text-xs text-muted">{label}</p>
        <p className="font-mono text-2xl font-semibold text-ink">{value}</p>
        <p className="mt-1 text-xs text-muted">{sublabel}</p>
      </div>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
        <Icon size={17} strokeWidth={2} />
      </div>
    </div>
  );
}

export function Dashboard() {
  const { user } = useAuth();
  const [gastos, setGastos] = useState<Gasto[] | null>(null);

  useEffect(() => {
    api.get<Gasto[]>("/gastos").then(setGastos);
  }, []);

  if (!gastos) return <p className="text-sm text-muted">Cargando...</p>;

  const pendientes = gastos.filter((g) => g.estado === "pendiente" || g.estado === "pendiente_validacion");
  const aprobados = gastos.filter((g) => g.estado === "aprobado");
  const totalPendiente = pendientes.reduce((sum, g) => sum + Number(g.monto), 0);
  const totalAprobado = aprobados.reduce((sum, g) => sum + Number(g.monto), 0);
  const totalGeneral = gastos.reduce((sum, g) => sum + Number(g.monto), 0);

  const porCategoria = (Object.keys(CATEGORIA_LABEL) as (keyof typeof CATEGORIA_LABEL)[]).map((cat) => ({
    label: CATEGORIA_LABEL[cat],
    value: gastos.filter((g) => g.categoria === cat).reduce((sum, g) => sum + Number(g.monto), 0),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
          {user?.rol === "empleado" ? "Tus gastos" : "Resumen de gastos"}
        </h1>
        <p className="text-sm text-muted">Así está la rendición de gastos hoy.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={Clock}
          label="Por aprobar ahora"
          value={<>S/ <CountUp value={totalPendiente} decimals={2} /></>}
          sublabel={`${pendientes.length} comprobante(s)`}
        />
        <StatCard
          icon={CheckCircle2}
          label="Aprobados"
          value={<>S/ <CountUp value={totalAprobado} decimals={2} /></>}
          sublabel={`${aprobados.length} comprobante(s)`}
        />
        <StatCard
          icon={Wallet}
          label="Total registrado"
          value={<>S/ <CountUp value={totalGeneral} decimals={2} /></>}
          sublabel={`${gastos.length} comprobante(s) en total`}
        />
      </div>

      <div className="receipt-card p-6">
        <h2 className="font-display mb-4 text-sm font-semibold text-ink">Gastos por categoría</h2>
        <CategoryBarChart data={porCategoria} />
      </div>

      <div>
        <h2 className="font-display mb-3 text-sm font-semibold uppercase tracking-widest text-muted">
          Últimos gastos
        </h2>
        <div className="flex flex-col gap-3">
          {gastos.slice(0, 8).map((g) => (
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
          {gastos.length === 0 && <p className="py-6 text-center text-sm text-muted">Todavía no hay gastos registrados.</p>}
        </div>
      </div>
    </div>
  );
}
