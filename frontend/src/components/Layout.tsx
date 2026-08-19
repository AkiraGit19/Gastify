import { NavLink, Outlet, useLocation } from "react-router-dom";
import { LayoutDashboard, Receipt, CheckSquare, Users, Building2, LogOut, ChevronRight } from "lucide-react";
import { useAuth, type Rol } from "../lib/auth";
import { Logo } from "./Logo";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: Rol[];
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "aprobador", "empleado"] },
  { to: "/gastos", label: "Gastos", icon: Receipt, roles: ["admin", "empleado"] },
  { to: "/aprobaciones", label: "Aprobaciones", icon: CheckSquare, roles: ["admin", "aprobador"] },
  { to: "/equipo", label: "Equipo", icon: Users, roles: ["admin"] },
  { to: "/empresas", label: "Empresas", icon: Building2, roles: ["super_admin"] },
];

const ROL_LABEL: Record<Rol, string> = {
  super_admin: "Dueño de plataforma",
  admin: "Administrador",
  aprobador: "Aprobador",
  empleado: "Rendidor",
};

export function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  if (!user) return null;

  const items = NAV_ITEMS.filter((item) => item.roles.includes(user.rol));
  const current = items.find((item) => (item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to)));

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col border-r border-ink/8 bg-surface p-4">
        <div className="mb-10 flex items-center gap-2 px-2 pt-2">
          <Logo size={30} />
          <span className="font-display text-lg font-semibold tracking-tight text-ink">Gastify</span>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }: { isActive: boolean }) =>
                `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-brand-soft text-brand"
                    : "text-muted hover:bg-page hover:text-ink"
                }`
              }
            >
              <Icon size={17} strokeWidth={2} />
              {label}
            </NavLink>
          ))}
        </nav>

        <button
          onClick={logout}
          className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-page hover:text-ink"
        >
          <LogOut size={17} strokeWidth={2} />
          Cerrar sesión
        </button>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-ink/8 bg-surface px-8 py-3.5">
          <div className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-muted">
            <span>{ROL_LABEL[user.rol]}</span>
            <ChevronRight size={12} />
            <span className="text-ink">{current?.label ?? "Dashboard"}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-medium text-ink">{user.nombre}</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rail text-xs font-semibold text-white">
              {user.nombre.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <main className="flex-1 p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
