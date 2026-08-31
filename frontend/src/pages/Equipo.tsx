import { useEffect, useState, type FormEvent } from "react";
import { UserPlus } from "lucide-react";
import { api, ApiError } from "../lib/api";
import type { Usuario } from "../lib/types";
import { Modal } from "../components/Modal";
import { useAuth } from "../lib/auth";

const ROL_LABEL: Record<Usuario["rol"], string> = {
  admin: "Administrador",
  aprobador: "Aprobador",
  empleado: "Empleado",
};

export function Equipo() {
  const { user } = useAuth();
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [resetTarget, setResetTarget] = useState<Usuario | null>(null);
  const [error, setError] = useState("");

  function load() {
    api.get<Usuario[]>("/usuarios").then(setUsuarios);
  }

  useEffect(load, []);

  const aprobadores = usuarios?.filter((u) => u.rol === "aprobador") ?? [];

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      await api.post("/usuarios", {
        nombre: form.get("nombre"),
        email: form.get("email"),
        telefonoWhatsapp: form.get("telefonoWhatsapp"),
        rol: form.get("rol"),
        aprobadorId: form.get("aprobadorId") || undefined,
        password: form.get("password"),
      });
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear el usuario");
    }
  }

  async function toggleActivo(u: Usuario) {
    setError("");
    try {
      await api.patch(`/usuarios/${u.id}`, { activo: !u.activo });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo actualizar el usuario");
    }
  }

  async function handleReset(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!resetTarget) return;
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      await api.patch(`/usuarios/${resetTarget.id}`, { password: form.get("password") });
      setResetTarget(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo restablecer la contraseña");
    }
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between border-b border-ink/8 pb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Equipo</h1>
          <p className="mt-1 text-sm text-muted">Empleados y aprobadores de tu empresa.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
        >
          <UserPlus size={16} /> Nuevo miembro
        </button>
      </div>

      {showForm && (
        <Modal title="Nuevo miembro" onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3">
            <input name="nombre" required placeholder="Nombre completo" className="rounded-md border border-ink/12 bg-page px-3 py-2 text-sm" />
            <input name="email" type="email" required placeholder="Correo" className="rounded-md border border-ink/12 bg-page px-3 py-2 text-sm" />
            <input name="telefonoWhatsapp" required placeholder="Teléfono WhatsApp (51999...)" className="rounded-md border border-ink/12 bg-page px-3 py-2 text-sm" />
            <input
              name="password"
              type="password"
              required
              minLength={8}
              placeholder="Contraseña inicial (mín. 8 caracteres)"
              className="rounded-md border border-ink/12 bg-page px-3 py-2 text-sm"
            />
            <select name="rol" className="rounded-md border border-ink/12 bg-page px-3 py-2 text-sm">
              <option value="empleado">Empleado</option>
              <option value="aprobador">Aprobador</option>
            </select>
            <select name="aprobadorId" className="rounded-md border border-ink/12 bg-page px-3 py-2 text-sm">
              <option value="">Sin aprobador asignado</option>
              {aprobadores.map((a) => (
                <option key={a.id} value={a.id}>{a.nombre}</option>
              ))}
            </select>
            {error && <p className="text-sm text-stamp-rechazado">{error}</p>}
            <button type="submit" className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white">
              Crear
            </button>
          </form>
        </Modal>
      )}

      {resetTarget && (
        <Modal title={`Restablecer contraseña — ${resetTarget.nombre}`} onClose={() => setResetTarget(null)}>
          <form onSubmit={handleReset} className="grid grid-cols-1 gap-3">
            <input
              name="password"
              type="password"
              required
              minLength={8}
              autoFocus
              placeholder="Nueva contraseña (mín. 8 caracteres)"
              className="rounded-md border border-ink/12 bg-page px-3 py-2 text-sm"
            />
            {error && <p className="text-sm text-stamp-rechazado">{error}</p>}
            <button type="submit" className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white">
              Guardar
            </button>
          </form>
        </Modal>
      )}

      {error && !showForm && !resetTarget && <p className="border-b border-ink/8 py-3 text-sm text-stamp-rechazado">{error}</p>}

      <div className="pt-6">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink/8 text-xs text-muted">
                <th className="py-2 pr-4 font-medium">Colaborador</th>
                <th className="py-2 pr-4 font-medium">Rol</th>
                <th className="py-2 pr-4 font-medium">Teléfono</th>
                <th className="py-2 pr-0 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios?.map((u) => (
                <tr key={u.id} className="border-b border-ink/6 last:border-0">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand">
                        {u.nombre.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink">{u.nombre}</p>
                        <p className="truncate text-xs text-muted">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <span className="rounded-full bg-page px-2.5 py-1 text-xs font-medium text-ink">
                      {ROL_LABEL[u.rol] ?? u.rol}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-muted">{u.telefonoWhatsapp}</td>
                  <td className="py-3 pr-0">
                    <div className="flex items-center justify-end gap-1">
                      {u.id !== user?.id && (
                        <button
                          onClick={() => setResetTarget(u)}
                          className="rounded-md px-3 py-1.5 text-xs font-semibold text-muted hover:text-ink"
                        >
                          Restablecer contraseña
                        </button>
                      )}
                      {u.id === user?.id ? (
                        <span className="px-3 py-1.5 text-xs text-muted">Eres tú</span>
                      ) : (
                        <button
                          onClick={() => toggleActivo(u)}
                          className={`rounded-md px-3 py-1.5 text-xs font-semibold ${u.activo ? "text-stamp-rechazado" : "text-stamp-aprobado"}`}
                        >
                          {u.activo ? "Dar de baja" : "Reactivar"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {usuarios?.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-muted">
                    Todavía no hay miembros en tu equipo.
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
