import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Camera, Check, LoaderCircle, RotateCcw, LogOut } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Logo } from "../components/Logo";

type Respuesta =
  | { estado: "registrado"; gastoId: string; aprobador: string | null }
  | { estado: "falta_monto"; borrador: string };

type Vista =
  | { paso: "inicio" }
  | { paso: "subiendo" }
  | { paso: "falta_monto"; borrador: string }
  | { paso: "listo"; aprobador: string | null }
  | { paso: "error"; mensaje: string };

// Toda la pantalla del empleado. Un botón, una foto, listo. Deliberadamente no hay formulario de
// confirmación: el único dato que se pregunta es el monto, y solo cuando no se pudo leer de la
// boleta, porque sin monto el gasto no se puede registrar.
export function Subir() {
  const { user, logout } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [vista, setVista] = useState<Vista>({ paso: "inicio" });
  const [monto, setMonto] = useState("");

  async function subirFoto(e: ChangeEvent<HTMLInputElement>) {
    const foto = e.target.files?.[0];
    // Permite reintentar con la misma foto: sin esto el input no dispara change dos veces seguidas.
    e.target.value = "";
    if (!foto) return;

    setVista({ paso: "subiendo" });
    const form = new FormData();
    form.append("foto", foto);

    try {
      const res = await api.upload<Respuesta>("/gastos", form);
      if (res.estado === "falta_monto") {
        setMonto("");
        setVista({ paso: "falta_monto", borrador: res.borrador });
      } else {
        setVista({ paso: "listo", aprobador: res.aprobador });
      }
    } catch (err) {
      setVista({ paso: "error", mensaje: err instanceof ApiError ? err.message : "No se pudo subir la foto. Revisa tu conexión." });
    }
  }

  async function confirmarMonto(e: FormEvent) {
    e.preventDefault();
    if (vista.paso !== "falta_monto") return;
    const borrador = vista.borrador;
    setVista({ paso: "subiendo" });
    try {
      const creado = await api.post<{ aprobador: string | null }>("/gastos/borrador", {
        borrador,
        monto: Number(monto.replace(",", ".")),
      });
      setVista({ paso: "listo", aprobador: creado.aprobador });
    } catch (err) {
      setVista({ paso: "error", mensaje: err instanceof ApiError ? err.message : "No se pudo registrar el gasto." });
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-page">
      <header className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <Logo size={26} />
          <span className="font-display font-semibold tracking-tight text-ink">Gastify</span>
        </div>
        <button onClick={logout} className="flex items-center gap-1.5 text-sm text-muted" aria-label="Cerrar sesión">
          <LogOut size={15} />
        </button>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-10 text-center">
        {vista.paso === "inicio" && (
          <>
            <p className="mb-1 text-sm text-muted">Hola, {user?.nombre.split(" ")[0]}</p>
            <h1 className="font-display mb-10 text-2xl font-semibold tracking-tight text-ink">
              Registra tu boleta
            </h1>
            <BotonCamara onClick={() => inputRef.current?.click()} />
            <p className="mt-6 max-w-xs text-sm text-muted">
              Toma la foto y listo. Nosotros leemos el monto, la fecha y el RUC.
            </p>
          </>
        )}

        {vista.paso === "subiendo" && (
          <>
            <LoaderCircle size={44} className="mb-5 animate-spin text-brand" />
            <p className="font-display text-lg font-semibold text-ink">Leyendo tu boleta…</p>
            <p className="mt-1 text-sm text-muted">Toma unos segundos.</p>
          </>
        )}

        {vista.paso === "falta_monto" && (
          <form onSubmit={confirmarMonto} className="w-full max-w-xs">
            <h1 className="font-display mb-1 text-xl font-semibold tracking-tight text-ink">¿Cuánto fue?</h1>
            <p className="mb-6 text-sm text-muted">No pude leer el total en la boleta.</p>
            <div className="flex items-center gap-2 rounded-md border border-ink/12 bg-surface px-4 py-3 focus-within:border-brand">
              <span className="text-lg font-semibold text-muted">S/</span>
              <input
                autoFocus
                required
                inputMode="decimal"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="0.00"
                className="w-full bg-transparent text-lg font-semibold text-ink outline-none placeholder:text-muted/50"
              />
            </div>
            <button
              type="submit"
              className="mt-5 w-full rounded-md bg-brand px-4 py-3 text-sm font-semibold text-white active:scale-[0.99]"
            >
              Registrar gasto
            </button>
          </form>
        )}

        {vista.paso === "listo" && (
          <>
            <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-stamp-aprobado/12 text-stamp-aprobado">
              <Check size={32} strokeWidth={2.5} />
            </span>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Gasto registrado</h1>
            <p className="mt-1 text-sm text-muted">
              {vista.aprobador ? `Enviado a ${vista.aprobador} para aprobación.` : "Enviado para aprobación."}
            </p>
            <button
              onClick={() => setVista({ paso: "inicio" })}
              className="mt-8 flex items-center gap-2 rounded-md bg-brand px-5 py-3 text-sm font-semibold text-white active:scale-[0.99]"
            >
              <Camera size={16} /> Subir otra
            </button>
          </>
        )}

        {vista.paso === "error" && (
          <>
            <h1 className="font-display mb-2 text-xl font-semibold tracking-tight text-ink">No se pudo registrar</h1>
            <p className="mb-8 max-w-xs text-sm text-muted">{vista.mensaje}</p>
            <button
              onClick={() => setVista({ paso: "inicio" })}
              className="flex items-center gap-2 rounded-md bg-brand px-5 py-3 text-sm font-semibold text-white active:scale-[0.99]"
            >
              <RotateCcw size={16} /> Intentar de nuevo
            </button>
          </>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          // capture abre la cámara trasera directo en el celular; en escritorio es un selector normal.
          capture="environment"
          onChange={subirFoto}
          className="hidden"
        />
      </main>
    </div>
  );
}

function BotonCamara({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex h-40 w-40 flex-col items-center justify-center gap-3 rounded-full bg-brand text-white shadow-lg shadow-brand/25 transition-transform active:scale-95"
    >
      <Camera size={40} strokeWidth={1.75} />
      <span className="text-sm font-semibold">Tomar foto</span>
    </button>
  );
}
