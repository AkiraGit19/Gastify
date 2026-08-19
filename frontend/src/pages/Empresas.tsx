import { useEffect, useState, type FormEvent } from "react";
import { Building2, PlusCircle } from "lucide-react";
import { api, ApiError } from "../lib/api";

interface Empresa {
  id: string;
  razonSocial: string;
  ruc: string;
  fechaAlta: string;
  _count: { usuarios: number; gastos: number };
}

export function Empresas() {
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Empresas</h1>
          <p className="text-sm text-muted">Clientes de la plataforma. Cada uno con sus datos completamente separados.</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
        >
          <PlusCircle size={16} /> Nueva empresa
        </button>
      </div>

      {success && <p className="rounded-lg bg-success-soft p-3 text-sm text-success">{success}</p>}

      {showForm && (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 rounded-2xl bg-surface p-6 shadow-sm shadow-ink/5 sm:grid-cols-2">
          <input name="razonSocial" required placeholder="Razón social" className="rounded-lg border border-brand-soft bg-page px-3 py-2 text-sm" />
          <input name="ruc" required placeholder="RUC" className="rounded-lg border border-brand-soft bg-page px-3 py-2 text-sm" />
          <input name="adminNombre" required placeholder="Nombre del admin" className="rounded-lg border border-brand-soft bg-page px-3 py-2 text-sm" />
          <input name="adminEmail" type="email" required placeholder="Email del admin" className="rounded-lg border border-brand-soft bg-page px-3 py-2 text-sm" />
          {error && <p className="text-sm text-danger sm:col-span-2">{error}</p>}
          <button type="submit" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white sm:col-span-2">
            Crear empresa
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {empresas?.map((e) => (
          <div key={e.id} className="rounded-2xl bg-surface p-5 shadow-sm shadow-ink/5">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-brand-soft text-brand">
              <Building2 size={18} />
            </div>
            <p className="font-medium text-ink">{e.razonSocial}</p>
            <p className="text-xs text-muted">RUC {e.ruc}</p>
            <p className="mt-3 text-xs text-muted">{e._count.usuarios} usuarios · {e._count.gastos} gastos</p>
          </div>
        ))}
      </div>
    </div>
  );
}
