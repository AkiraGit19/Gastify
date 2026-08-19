import { useState, type FormEvent } from "react";
import { Mail, ScrollText } from "lucide-react";
import { api, ApiError } from "../lib/api";

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
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="receipt-card w-full max-w-sm p-8">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-rail text-brand">
            <ScrollText size={20} strokeWidth={2.25} />
          </div>
          <span className="font-display text-xl font-semibold tracking-tight text-ink">Gastify</span>
        </div>

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
  );
}
