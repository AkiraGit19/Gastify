import { useEffect, useState, type FormEvent } from "react";
import { Building2, User, KeyRound } from "lucide-react";
import { api, ApiError } from "../lib/api";
import type { Empresa } from "../lib/types";
import { useAuth } from "../lib/auth";

const inputClass = "rounded-md border border-ink/12 bg-page px-3 py-2 text-sm";

export function Configuracion() {
  const { user, updateUser } = useAuth();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Configuración</h1>
        <p className="text-sm text-muted">Ajustes de tu empresa y de tu cuenta.</p>
      </div>

      {user?.rol === "admin" && <PerfilEmpresa />}

      <PerfilPersonal nombreInicial={user?.nombre ?? ""} telefonoInicial={null} onGuardado={(nombre) => updateUser({ nombre })} />

      <CambiarContrasena />
    </div>
  );
}

function CambiarContrasena() {
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setOk(false);
    const form = e.currentTarget;
    const data = new FormData(form);
    try {
      await api.patch("/usuarios/me", {
        currentPassword: data.get("currentPassword"),
        newPassword: data.get("newPassword"),
      });
      setOk(true);
      form.reset();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cambiar la contraseña");
    }
  }

  return (
    <section className="receipt-card flex flex-col gap-4 p-6">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-brand">
          <KeyRound size={16} />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-ink">Cambiar contraseña</h2>
          <p className="text-xs text-muted">Necesitas tu contraseña actual para poner una nueva.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:max-w-sm">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Contraseña actual
          <input name="currentPassword" type="password" required className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Contraseña nueva
          <input name="newPassword" type="password" required minLength={8} className={inputClass} />
        </label>
        {error && <p className="text-sm text-stamp-rechazado">{error}</p>}
        {ok && <p className="text-sm text-stamp-aprobado">Contraseña actualizada.</p>}
        <button type="submit" className="w-fit rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white">
          Cambiar contraseña
        </button>
      </form>
    </section>
  );
}

function PerfilEmpresa() {
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  useEffect(() => {
    api.get<Empresa>("/mi-empresa").then(setEmpresa);
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setOk(false);
    const form = new FormData(e.currentTarget);
    try {
      const updated = await api.patch<Empresa>("/mi-empresa", {
        razonSocial: form.get("razonSocial"),
        ruc: form.get("ruc"),
      });
      setEmpresa(updated);
      setOk(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar");
    }
  }

  return (
    <section className="receipt-card flex flex-col gap-4 p-6">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-brand">
          <Building2 size={16} />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-ink">Datos de la empresa</h2>
          <p className="text-xs text-muted">Visible en tus reportes y comprobantes.</p>
        </div>
      </div>

      {empresa && (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:max-w-sm" key={empresa.id}>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted">
            Razón social
            <input name="razonSocial" required defaultValue={empresa.razonSocial} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted">
            RUC
            <input name="ruc" required defaultValue={empresa.ruc} className={inputClass} />
          </label>
          {error && <p className="text-sm text-stamp-rechazado">{error}</p>}
          {ok && <p className="text-sm text-stamp-aprobado">Guardado.</p>}
          <button type="submit" className="w-fit rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white">
            Guardar
          </button>
        </form>
      )}
    </section>
  );
}

function PerfilPersonal({
  nombreInicial,
  telefonoInicial,
  onGuardado,
}: {
  nombreInicial: string;
  telefonoInicial: string | null;
  onGuardado: (nombre: string) => void;
}) {
  const [telefono, setTelefono] = useState(telefonoInicial);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  useEffect(() => {
    api.get<{ telefonoWhatsapp: string | null }>("/usuarios/me").then((u) => setTelefono(u.telefonoWhatsapp));
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setOk(false);
    const form = new FormData(e.currentTarget);
    try {
      const updated = await api.patch<{ nombre: string; telefonoWhatsapp: string | null }>("/usuarios/me", {
        nombre: form.get("nombre"),
        telefonoWhatsapp: form.get("telefonoWhatsapp") || null,
      });
      setTelefono(updated.telefonoWhatsapp);
      onGuardado(updated.nombre);
      setOk(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar");
    }
  }

  return (
    <section className="receipt-card flex flex-col gap-4 p-6">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-brand">
          <User size={16} />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-ink">Mi perfil</h2>
          <p className="text-xs text-muted">Tu nombre y el número de WhatsApp vinculado a tu cuenta.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:max-w-sm" key={telefono ?? "sin-telefono"}>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Nombre
          <input name="nombre" required defaultValue={nombreInicial} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Teléfono WhatsApp
          <input name="telefonoWhatsapp" placeholder="51999999999" defaultValue={telefono ?? ""} className={inputClass} />
        </label>
        {error && <p className="text-sm text-stamp-rechazado">{error}</p>}
        {ok && <p className="text-sm text-stamp-aprobado">Guardado.</p>}
        <button type="submit" className="w-fit rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white">
          Guardar
        </button>
      </form>
    </section>
  );
}
