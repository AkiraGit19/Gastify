import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useAuth, type SessionUser } from "../lib/auth";

export function VerifyMagicLink() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState("");

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setError("Enlace inválido.");
      return;
    }

    api
      .post<{ token: string; user: SessionUser }>("/auth/verify", { token })
      .then((res) => {
        login(res.token, res.user);
        navigate("/", { replace: true });
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Enlace inválido o expirado."));
  }, [params, login, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-page px-4">
      <div className="w-full max-w-sm rounded-2xl bg-surface p-8 text-center shadow-sm shadow-ink/5">
        {error ? (
          <>
            <p className="mb-4 text-sm text-danger">{error}</p>
            <a href="/login" className="text-sm font-medium text-brand">Volver a pedir un enlace</a>
          </>
        ) : (
          <p className="text-sm text-muted">Verificando tu enlace de acceso...</p>
        )}
      </div>
    </div>
  );
}
