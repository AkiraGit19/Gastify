import { useState, type FormEvent } from "react";
import { Mail, Wallet } from "lucide-react";
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
    <div className="flex min-h-screen items-center justify-center bg-page px-4">
      <div className="w-full max-w-sm rounded-2xl bg-surface p-8 shadow-sm shadow-ink/5">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-white">
            <Wallet size={20} />
          </div>
          <span className="text-xl font-semibold text-ink">Gastify</span>
        </div>

        {status === "sent" ? (
          <div className="rounded-lg bg-success-soft p-4 text-sm text-success">
            Te enviamos un enlace de acceso a <strong>{email}</strong>. Revisa tu correo y haz clic para entrar.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">Correo electrónico</label>
              <div className="flex items-center gap-2 rounded-lg border border-brand-soft bg-page px-3 py-2.5 focus-within:border-brand">
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

            {status === "error" && <p className="text-sm text-danger">{error}</p>}

            <button
              type="submit"
              disabled={status === "loading"}
              className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
            >
              {status === "loading" ? "Enviando..." : "Enviarme un enlace de acceso"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
