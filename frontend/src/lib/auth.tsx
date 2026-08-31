import { createContext, useContext, useState, type ReactNode } from "react";

export type Rol = "super_admin" | "admin" | "aprobador" | "empleado";

export interface SessionUser {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  empresaId: string | null;
}

interface AuthContextValue {
  user: SessionUser | null;
  login: (token: string, user: SessionUser) => void;
  logout: () => void;
  updateUser: (patch: Partial<SessionUser>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadStoredUser(): SessionUser | null {
  const raw = localStorage.getItem("gastify_user");
  return raw ? (JSON.parse(raw) as SessionUser) : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(loadStoredUser);

  function login(token: string, user: SessionUser) {
    localStorage.setItem("gastify_token", token);
    localStorage.setItem("gastify_user", JSON.stringify(user));
    setUser(user);
  }

  function logout() {
    localStorage.removeItem("gastify_token");
    localStorage.removeItem("gastify_user");
    setUser(null);
  }

  function updateUser(patch: Partial<SessionUser>) {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      localStorage.setItem("gastify_user", JSON.stringify(next));
      return next;
    });
  }

  return <AuthContext.Provider value={{ user, login, logout, updateUser }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
