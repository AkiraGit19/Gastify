import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Gasto } from "../lib/types";
import { CATEGORIA_LABEL } from "../lib/types";
import { CountUp } from "../components/CountUp";
import { ReceiptRow } from "../components/ReceiptRow";
import { useAuth } from "../lib/auth";

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

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
          {user?.rol === "empleado" ? "Tus gastos" : "Resumen de gastos"}
        </h1>
        <p className="text-sm text-muted">Así está la rendición de gastos hoy.</p>
      </div>

      {/* Ledger-style total, like the bottom line of a receipt, instead of three identical tiles. */}
      <div className="receipt-card flex flex-col gap-6 px-7 py-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-stamp-pendiente">
            Por aprobar ahora
          </p>
          <p className="font-mono text-4xl font-semibold tracking-tight text-ink">
            S/ <CountUp value={totalPendiente} decimals={2} />
          </p>
          <p className="mt-1 text-xs text-muted">{pendientes.length} comprobante(s) esperando decisión</p>
        </div>
        <div className="flex gap-8 border-t border-ink/8 pt-4 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-8">
          <div>
            <p className="font-mono text-2xl font-semibold text-stamp-aprobado">
              <CountUp value={aprobados.length} />
            </p>
            <p className="text-xs text-muted">Aprobados</p>
          </div>
          <div>
            <p className="font-mono text-2xl font-semibold text-ink">
              <CountUp value={gastos.length} />
            </p>
            <p className="text-xs text-muted">Total registrados</p>
          </div>
        </div>
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
