import { useEffect, useState, type FormEvent } from "react";
import { PlusCircle } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { CountUp } from "../components/CountUp";
import { Modal } from "../components/Modal";
import { relativeDate } from "../lib/format";

interface Empresa {
  id: string;
  razonSocial: string;
  ruc: string;
  fechaAlta: string;
  _count: { usuarios: number; gastos: number };
}

export function SuperAdminHome() {
  const [empresas, setEmpresas] = useState<Empresa[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  function load() {
    api.get<Empresa[]>("/empresas").then(setEmpresas);
  }

  useEffect(load, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      await api.post("/empresas", {
        razonSocial: form.get("razonSocial"),
        ruc: form.get("ruc"),
        adminNombre: form.get("adminNombre"),
        adminEmail: form.get("adminEmail"),
      });
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear la empresa");
    }
  }

  const totalUsuarios = empresas?.reduce((sum, e) => sum + e._count.usuarios, 0) ?? 0;
  const totalGastos = empresas?.reduce((sum, e) => sum + e._count.gastos, 0) ?? 0;

  return (
    <div className="flex flex-col">
      <div className="flex flex-col justify-between gap-4 border-b border-ink/8 pb-6 sm:flex-row sm:items-start">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Panel de plataforma</h1>
          <p className="mt-1 text-sm text-muted">Todas las empresas que usan Gastify, cada una con sus datos separados.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center justify-center gap-2 rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
        >
          <PlusCircle size={16} /> Nueva empresa
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 border-b border-ink/8 py-6 sm:grid-cols-3">
        <div>
          <p className="mb-2 text-sm text-muted">Empresas</p>
          <p className="text-2xl font-semibold tabular-nums text-ink">
            <CountUp value={empresas?.length ?? 0} />
          </p>
          <p className="mt-1 text-xs text-muted">clientes activos</p>
        </div>
        <div>
          <p className="mb-2 text-sm text-muted">Usuarios</p>
          <p className="text-2xl font-semibold tabular-nums text-ink">
            <CountUp value={totalUsuarios} />
          </p>
          <p className="mt-1 text-xs text-muted">en toda la plataforma</p>
        </div>
        <div>
          <p className="mb-2 text-sm text-muted">Gastos</p>
          <p className="text-2xl font-semibold tabular-nums text-ink">
            <CountUp value={totalGastos} />
          </p>
          <p className="mt-1 text-xs text-muted">registrados en total</p>
        </div>
      </div>

      {showForm && (
        <Modal title="Nueva empresa" onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3">
            <input name="razonSocial" required placeholder="Razón social" className="rounded-md border border-ink/12 bg-page px-3 py-2 text-sm" />
            <input name="ruc" required placeholder="RUC" className="rounded-md border border-ink/12 bg-page px-3 py-2 text-sm" />
            <input name="adminNombre" required placeholder="Nombre del admin" className="rounded-md border border-ink/12 bg-page px-3 py-2 text-sm" />
            <input name="adminEmail" type="email" required placeholder="Email del admin" className="rounded-md border border-ink/12 bg-page px-3 py-2 text-sm" />
            {error && <p className="text-sm text-stamp-rechazado">{error}</p>}
            <button type="submit" className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white">
              Crear empresa
            </button>
          </form>
        </Modal>
      )}

      <div className="pt-6">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink/8 text-xs text-muted">
                <th className="py-2 pr-4 font-medium">Empresa</th>
                <th className="py-2 pr-4 font-medium">RUC</th>
                <th className="py-2 pr-4 font-medium">Usuarios</th>
                <th className="py-2 pr-4 font-medium">Gastos</th>
                <th className="py-2 pr-0 font-medium">Alta</th>
              </tr>
            </thead>
            <tbody>
              {empresas?.map((e) => (
                <tr key={e.id} className="border-b border-ink/6 last:border-0">
                  <td className="py-3 pr-4 font-medium text-ink">{e.razonSocial}</td>
                  <td className="py-3 pr-4 text-muted">{e.ruc}</td>
                  <td className="py-3 pr-4 tabular-nums text-muted">{e._count.usuarios}</td>
                  <td className="py-3 pr-4 tabular-nums text-muted">{e._count.gastos}</td>
                  <td className="py-3 pr-0 text-muted">{relativeDate(e.fechaAlta)}</td>
                </tr>
              ))}
              {empresas?.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-muted">
                    Todavía no has dado de alta ninguna empresa.
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
