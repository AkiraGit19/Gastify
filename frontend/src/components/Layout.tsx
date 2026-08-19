import { NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, Receipt, CheckSquare, Users, Building2, LogOut, Wallet } from "lucide-react";
import { useAuth, type Rol } from "../lib/auth";

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

export function Layout() {
  const { user, logout } = useAuth();
  if (!user) return null;

  const items = NAV_ITEMS.filter((item) => item.roles.includes(user.rol));

  return (
    <div className="flex min-h-screen bg-page">
      <aside className="flex w-60 shrink-0 flex-col border-r border-brand-soft bg-surface p-4">
        <div className="mb-8 flex items-center gap-2 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white">
            <Wallet size={18} />
          </div>
          <span className="text-lg font-semibold text-ink">Gastify</span>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }: { isActive: boolean }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? "bg-brand-soft text-brand" : "text-muted hover:bg-page hover:text-ink"
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <button
          onClick={logout}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-page hover:text-danger"
        >
          <LogOut size={18} />
          Cerrar sesión
        </button>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-brand-soft bg-surface px-8 py-4">
          <div>
            <p className="text-sm text-muted">Hola,</p>
            <p className="font-semibold text-ink">{user.nombre}</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand">
            {user.nombre.charAt(0).toUpperCase()}
          </div>
        </header>

        <main className="flex-1 p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
