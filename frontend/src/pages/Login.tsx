import { useState, type FormEvent } from "react";
import { Mail, Camera, ShieldCheck, CheckCircle2 } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { Logo } from "../components/Logo";

const STEPS = [
  { icon: Camera, text: "El empleado manda una foto de su boleta por WhatsApp" },
  { icon: ShieldCheck, text: "El sistema la lee y la valida contra SUNAT" },
  { icon: CheckCircle2, text: "El aprobador decide en segundos, aquí mismo" },
];

export function Login() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      await api.post("/auth/magic-link", { email });
      setStatus("sent");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo enviar el enlace");
      setStatus("error");
    }
  }

  return (
    <div className="flex min-h-screen">
      <div className="relative hidden w-[42%] flex-col justify-between overflow-hidden bg-rail p-10 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "22px 22px",
          }}
        />
        <div className="relative flex items-center gap-2">
          <Logo size={30} />
          <span className="font-display text-lg font-semibold tracking-tight">Gastify</span>
        </div>

        <div className="relative">
          <h1 className="font-display mb-8 max-w-xs text-3xl font-semibold leading-snug tracking-tight">
            Rendición de gastos sin planillas ni PDFs perdidos.
          </h1>
          <ul className="flex flex-col gap-4">
            {STEPS.map(({ icon: Icon, text }, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-white/80">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-brand">
                  <Icon size={14} />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative font-mono text-xs text-white/40">Perú · SUNAT · WhatsApp Business</p>
      </div>

      <div className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <Logo size={32} />
            <span className="font-display text-xl font-semibold tracking-tight text-ink">Gastify</span>
          </div>

          <h2 className="font-display mb-1 text-xl font-semibold text-ink">Entrar a tu cuenta</h2>
          <p className="mb-6 text-sm text-muted">Sin contraseña — te mandamos un enlace de acceso a tu correo.</p>

          {status === "sent" ? (
            <div className="border-l-2 border-stamp-aprobado bg-brand-soft/40 p-4 text-sm text-ink">
              Si <strong>{email}</strong> está registrado, te enviamos un enlace de acceso. Revisa tu correo.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink">Correo electrónico</label>
                <div className="flex items-center gap-2 rounded-md border border-ink/12 bg-page px-3 py-2.5 focus-within:border-brand">
                  <Mail size={16} className="text-muted" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tucorreo@empresa.com"
                    className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
                  />
                </div>
              </div>

              {status === "error" && <p className="text-sm text-stamp-rechazado">{error}</p>}

              <button
                type="submit"
                disabled={status === "loading"}
                className="rounded-md bg-rail px-4 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
              >
                {status === "loading" ? "Enviando..." : "Enviarme un enlace de acceso"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
