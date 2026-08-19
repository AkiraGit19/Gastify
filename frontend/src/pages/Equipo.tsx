import { useEffect, useState, type FormEvent } from "react";
import { UserPlus } from "lucide-react";
import { api, ApiError } from "../lib/api";
import type { Usuario } from "../lib/types";

export function Equipo() {
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null);
  const [showForm, setShowForm] = useState(false);
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
      });
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear el usuario");
    }
  }

  async function toggleActivo(u: Usuario) {
    await api.patch(`/usuarios/${u.id}`, { activo: !u.activo });
    load();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Equipo</h1>
          <p className="text-sm text-muted">Empleados y aprobadores de tu empresa.</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 rounded-md bg-rail px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
        >
          <UserPlus size={16} /> Nuevo miembro
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="receipt-card grid grid-cols-1 gap-3 p-6 sm:grid-cols-2">
          <input name="nombre" required placeholder="Nombre completo" className="rounded-md border border-ink/12 bg-page px-3 py-2 text-sm" />
          <input name="email" type="email" required placeholder="Correo" className="rounded-md border border-ink/12 bg-page px-3 py-2 text-sm" />
          <input name="telefonoWhatsapp" required placeholder="Teléfono WhatsApp (51999...)" className="rounded-md border border-ink/12 bg-page px-3 py-2 text-sm" />
          <select name="rol" className="rounded-md border border-ink/12 bg-page px-3 py-2 text-sm">
            <option value="empleado">Empleado</option>
            <option value="aprobador">Aprobador</option>
          </select>
          <select name="aprobadorId" className="rounded-md border border-ink/12 bg-page px-3 py-2 text-sm sm:col-span-2">
            <option value="">Sin aprobador asignado</option>
            {aprobadores.map((a) => (
              <option key={a.id} value={a.id}>{a.nombre}</option>
            ))}
          </select>
          {error && <p className="text-sm text-stamp-rechazado sm:col-span-2">{error}</p>}
          <button type="submit" className="rounded-md bg-rail px-4 py-2 text-sm font-semibold text-white sm:col-span-2">
            Crear
          </button>
        </form>
      )}

      <div className="flex flex-col gap-3">
        {usuarios?.map((u) => (
          <div key={u.id} className="receipt-card flex items-center gap-4 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{u.nombre}</p>
              <p className="font-mono text-xs text-muted">{u.email} · {u.telefonoWhatsapp}</p>
            </div>
            <span className="stamp text-brand">{u.rol}</span>
            <button
              onClick={() => toggleActivo(u)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${u.activo ? "text-stamp-rechazado" : "text-stamp-aprobado"}`}
            >
              {u.activo ? "Dar de baja" : "Reactivar"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
