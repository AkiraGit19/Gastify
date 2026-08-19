import { NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, Receipt, CheckSquare, Users, Building2, LogOut, ScrollText } from "lucide-react";
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
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col bg-rail p-4">
        <div className="mb-10 flex items-center gap-2 px-2 pt-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand text-rail">
            <ScrollText size={18} strokeWidth={2.25} />
          </div>
          <span className="font-display text-lg font-semibold tracking-tight text-white">Gastify</span>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }: { isActive: boolean }) =>
                `flex items-center gap-3 border-l-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "border-brand bg-white/5 text-white"
                    : "border-transparent text-white/50 hover:border-white/20 hover:text-white/80"
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
          className="flex items-center gap-3 border-l-2 border-transparent px-3 py-2.5 text-sm font-medium text-white/40 transition-colors hover:text-white/70"
        >
          <LogOut size={17} strokeWidth={2} />
          Cerrar sesión
        </button>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-ink/8 px-8 py-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted">Hola</p>
            <p className="font-display font-semibold text-ink">{user.nombre}</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-rail text-sm font-semibold text-white">
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
