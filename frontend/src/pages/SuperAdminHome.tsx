import { useEffect, useState, type FormEvent } from "react";
import { PlusCircle } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { CountUp } from "../components/CountUp";
import { Modal } from "../components/Modal";
import { relativeDate } from "../lib/format";

interface Administrador {
  id: string;
  nombre: string;
  email: string;
  activo: boolean;
}

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
  const [accesoDe, setAccesoDe] = useState<Empresa | null>(null);
  const [admins, setAdmins] = useState<Administrador[] | null>(null);
  const [link, setLink] = useState("");
  const [copiado, setCopiado] = useState(false);

  // El admin de una empresa que pierde su contraseña no tenía forma de volver a entrar: el router
  // de /usuarios está limitado al rol admin y con alcance a su propia empresa, así que ni el
  // super_admin llegaba. La única salida era editar la base a mano.
  async function abrirAcceso(empresa: Empresa) {
    setError("");
    setLink("");
    setCopiado(false);
    setAccesoDe(empresa);
    setAdmins(null);
    try {
      setAdmins(await api.get<Administrador[]>(`/empresas/${empresa.id}/administradores`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudieron cargar los administradores");
      setAccesoDe(null);
    }
  }

  async function generarAcceso(usuarioId: string) {
    if (!accesoDe) return;
    setError("");
    try {
      const res = await api.post<{ url: string }>(`/empresas/${accesoDe.id}/administradores/${usuarioId}/acceso`, {});
      setLink(res.url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo generar el link");
    }
  }

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
        adminPassword: form.get("adminPassword"),
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
            <input
              name="adminPassword"
              type="password"
              required
              minLength={8}
              placeholder="Contraseña inicial del admin (mín. 8 caracteres)"
              className="rounded-md border border-ink/12 bg-page px-3 py-2 text-sm"
            />
            {error && <p className="text-sm text-stamp-rechazado">{error}</p>}
            <button type="submit" className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white">
              Crear empresa
            </button>
          </form>
        </Modal>
      )}

      {accesoDe && (
        <Modal title={`Recuperar acceso — ${accesoDe.razonSocial}`} onClose={() => setAccesoDe(null)}>
          {!admins ? (
            <p className="text-sm text-muted">Cargando administradores…</p>
          ) : admins.length === 0 ? (
            <p className="text-sm text-muted">Esta empresa no tiene ningún administrador activo.</p>
          ) : link ? (
            <>
              <p className="mb-3 text-sm text-muted">
                Pásaselo por un canal donde ya sepas que es él. Vence en 7 días y sirve una sola vez:
                al usarlo elige contraseña nueva y este link queda muerto.
              </p>
              <input
                readOnly
                value={link}
                onFocus={(ev) => ev.currentTarget.select()}
                className="w-full rounded-md border border-ink/12 bg-page px-3 py-2 text-xs text-ink"
              />
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(link);
                    setCopiado(true);
                  } catch {
                    setCopiado(false);
                  }
                }}
                className="mt-3 w-full rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white"
              >
                {copiado ? "Copiado" : "Copiar link"}
              </button>
            </>
          ) : (
            <>
              <p className="mb-3 text-sm text-muted">¿A quién le generas el link de acceso?</p>
              <div className="flex flex-col gap-2">
                {admins.map((a) => (
                  <button
                    key={a.id}
                    disabled={!a.activo}
                    onClick={() => generarAcceso(a.id)}
                    className="flex items-center justify-between rounded-md border border-ink/12 px-3 py-2 text-left text-sm hover:border-brand disabled:opacity-50"
                  >
                    <span>
                      <span className="block font-medium text-ink">{a.nombre}</span>
                      <span className="block text-xs text-muted">{a.email}</span>
                    </span>
                    {!a.activo && <span className="text-xs text-muted">De baja</span>}
                  </button>
                ))}
              </div>
            </>
          )}
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
                <th className="py-2 pr-4 font-medium">Alta</th>
                <th className="py-2 pr-0 font-medium">Acceso</th>
              </tr>
            </thead>
            <tbody>
              {empresas?.map((e) => (
                <tr key={e.id} className="border-b border-ink/6 last:border-0">
                  <td className="py-3 pr-4 font-medium text-ink">{e.razonSocial}</td>
                  <td className="py-3 pr-4 text-muted">{e.ruc}</td>
                  <td className="py-3 pr-4 tabular-nums text-muted">{e._count.usuarios}</td>
                  <td className="py-3 pr-4 tabular-nums text-muted">{e._count.gastos}</td>
                  <td className="py-3 pr-4 text-muted">{relativeDate(e.fechaAlta)}</td>
                  <td className="py-3 pr-0">
                    <button
                      onClick={() => abrirAcceso(e)}
                      className="rounded-md px-3 py-1.5 text-xs font-semibold text-brand hover:underline"
                    >
                      Recuperar acceso
                    </button>
                  </td>
                </tr>
              ))}
              {empresas?.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-muted">
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
