import { useEffect, useState, type FormEvent } from "react";
import { Building2, Users, Receipt, PlusCircle } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { StatCard } from "../components/StatCard";
import { CountUp } from "../components/CountUp";

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
  const [success, setSuccess] = useState("");

  function load() {
    api.get<Empresa[]>("/empresas").then(setEmpresas);
  }

  useEffect(load, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSuccess("");
    const form = new FormData(e.currentTarget);
    try {
      await api.post("/empresas", {
        razonSocial: form.get("razonSocial"),
        ruc: form.get("ruc"),
        adminNombre: form.get("adminNombre"),
        adminEmail: form.get("adminEmail"),
      });
      setSuccess("Empresa creada. Se envió un enlace de acceso al admin.");
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear la empresa");
    }
  }

  const totalUsuarios = empresas?.reduce((sum, e) => sum + e._count.usuarios, 0) ?? 0;
  const totalGastos = empresas?.reduce((sum, e) => sum + e._count.gastos, 0) ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Panel de plataforma</h1>
        <p className="text-sm text-muted">Todas las empresas que usan Gastify, cada una con sus datos separados.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={Building2} label="Empresas" value={<CountUp value={empresas?.length ?? 0} />} sublabel="clientes activos" />
        <StatCard icon={Users} label="Usuarios" value={<CountUp value={totalUsuarios} />} sublabel="en toda la plataforma" />
        <StatCard icon={Receipt} label="Gastos" value={<CountUp value={totalGastos} />} sublabel="registrados en total" />
      </div>

      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-muted">Empresas</h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 rounded-md bg-rail px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
        >
          <PlusCircle size={16} /> Nueva empresa
        </button>
      </div>

      {success && <p className="border-l-2 border-stamp-aprobado bg-brand-soft/40 p-3 text-sm text-ink">{success}</p>}

      {showForm && (
        <form onSubmit={handleSubmit} className="receipt-card grid grid-cols-1 gap-3 p-6 sm:grid-cols-2">
          <input name="razonSocial" required placeholder="Razón social" className="rounded-md border border-ink/12 bg-page px-3 py-2 text-sm" />
          <input name="ruc" required placeholder="RUC" className="rounded-md border border-ink/12 bg-page px-3 py-2 text-sm" />
          <input name="adminNombre" required placeholder="Nombre del admin" className="rounded-md border border-ink/12 bg-page px-3 py-2 text-sm" />
          <input name="adminEmail" type="email" required placeholder="Email del admin" className="rounded-md border border-ink/12 bg-page px-3 py-2 text-sm" />
          {error && <p className="text-sm text-stamp-rechazado sm:col-span-2">{error}</p>}
          <button type="submit" className="rounded-md bg-rail px-4 py-2 text-sm font-semibold text-white sm:col-span-2">
            Crear empresa
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {empresas?.map((e) => (
          <div key={e.id} className="receipt-card p-5">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-rail text-brand">
              <Building2 size={18} />
            </div>
            <p className="font-medium text-ink">{e.razonSocial}</p>
            <p className="font-mono text-xs text-muted">RUC {e.ruc}</p>
            <p className="mt-3 font-mono text-xs text-muted">{e._count.usuarios} usuarios · {e._count.gastos} gastos</p>
          </div>
        ))}
        {empresas?.length === 0 && <p className="text-sm text-muted">Todavía no has dado de alta ninguna empresa.</p>}
      </div>
    </div>
  );
}
