import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Lock } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { useAuth, type SessionUser } from "../lib/auth";
import { Logo } from "../components/Logo";

// Única vez que el empleado escribe algo para entrar. Después de esto guarda la página en su
// pantalla de inicio y la sesión le dura un año, así que no vuelve a ver ni esta pantalla ni el login.
export function Invitacion() {
  const [params] = useSearchParams();
  const { login } = useAuth();
  const navigate = useNavigate();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await api.post<{ token: string; user: SessionUser }>("/auth/invitacion", { token, password });
      login(res.token, res.user);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo activar la cuenta");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-page px-6">
      <div className="w-full max-w-xs">
        <div className="mb-8 flex items-center gap-2">
          <Logo size={30} />
          <span className="font-display text-xl font-semibold tracking-tight text-ink">Gastify</span>
        </div>

        {!token ? (
          <p className="text-sm text-muted">
            Este link está incompleto. Pídele a tu administrador que te genere uno nuevo.
          </p>
        ) : (
          <>
            <h1 className="font-display mb-1 text-xl font-semibold tracking-tight text-ink">Crea tu contraseña</h1>
            <p className="mb-6 text-sm text-muted">La vas a necesitar solo si cambias de celular.</p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex items-center gap-2 rounded-md border border-ink/12 bg-surface px-3 py-2.5 focus-within:border-brand">
                <Lock size={16} className="text-muted" />
                <input
                  type="password"
                  required
                  minLength={8}
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
                />
              </div>

              {error && <p className="text-sm text-stamp-rechazado">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="rounded-md bg-brand px-4 py-3 text-sm font-semibold text-white active:scale-[0.99] disabled:opacity-60"
              >
                {loading ? "Activando…" : "Entrar"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
