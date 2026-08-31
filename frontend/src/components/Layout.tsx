import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { LayoutDashboard, Receipt, CheckSquare, Users, Building2, LogOut, ChevronRight, ChevronDown, Menu, X, Settings } from "lucide-react";
import { useAuth, type Rol } from "../lib/auth";
import { Logo } from "./Logo";
import { NotificationsBell } from "./NotificationsBell";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
}

// Each role's landing page is different (see Home in App.tsx), so the nav itself is built per role
// rather than filtered from one shared list — a super_admin's "/" is not the same page as an admin's.
function navFor(rol: Rol): NavItem[] {
  switch (rol) {
    case "super_admin":
      return [{ to: "/", label: "Empresas", icon: Building2 }];
    case "admin":
      return [
        { to: "/", label: "Dashboard", icon: LayoutDashboard },
        { to: "/gastos", label: "Gastos", icon: Receipt },
        { to: "/aprobaciones", label: "Aprobaciones", icon: CheckSquare },
        { to: "/equipo", label: "Equipo", icon: Users },
      ];
    case "aprobador":
      return [{ to: "/aprobaciones", label: "Aprobaciones", icon: CheckSquare }];
    case "empleado":
      return [
        { to: "/", label: "Dashboard", icon: LayoutDashboard },
        { to: "/gastos", label: "Mis gastos", icon: Receipt },
      ];
  }
}

const ROL_LABEL: Record<Rol, string> = {
  super_admin: "Dueño de plataforma",
  admin: "Administrador",
  aprobador: "Aprobador",
  empleado: "Rendidor",
};

function NavList({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-1 flex-col gap-0.5">
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          onClick={onNavigate}
          className={({ isActive }: { isActive: boolean }) =>
            `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive ? "bg-page text-ink" : "text-muted hover:bg-page hover:text-ink"
            }`
          }
        >
          <Icon size={17} strokeWidth={2} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

function SidebarFooter({ onNavigate }: { onNavigate?: () => void }) {
  const { logout } = useAuth();
  return (
    <div className="flex flex-col gap-0.5">
      <NavLink
        to="/configuracion"
        onClick={onNavigate}
        className={({ isActive }: { isActive: boolean }) =>
          `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
            isActive ? "bg-brand-soft text-brand" : "text-muted hover:bg-page hover:text-ink"
          }`
        }
      >
        <Settings size={17} strokeWidth={2} />
        Configuración
      </NavLink>
      <button
        onClick={logout}
        className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-page hover:text-ink"
      >
        <LogOut size={17} strokeWidth={2} />
        Cerrar sesión
      </button>
    </div>
  );
}

export function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  if (!user) return null;

  const items = navFor(user.rol);
  const current: NavItem | undefined = location.pathname.startsWith("/configuracion")
    ? { to: "/configuracion", label: "Configuración", icon: Settings }
    : items.find((item) => (item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to)));
  const CurrentIcon = current?.icon;

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-ink/8 bg-surface p-4 lg:flex">
        <div className="mb-10 flex items-center gap-2 px-2 pt-2">
          <Logo size={30} />
          <span className="font-display text-lg font-semibold tracking-tight text-ink">Gastify</span>
        </div>

        <NavList items={items} />

        <SidebarFooter />
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setDrawerOpen(false)} />
          <div className="relative flex w-64 flex-col bg-surface p-4 shadow-xl">
            <div className="mb-8 flex items-center justify-between px-2 pt-2">
              <div className="flex items-center gap-2">
                <Logo size={28} />
                <span className="font-display text-lg font-semibold tracking-tight text-ink">Gastify</span>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="text-muted hover:text-ink">
                <X size={20} />
              </button>
            </div>

            <NavList items={items} onNavigate={() => setDrawerOpen(false)} />

            <SidebarFooter onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-ink/8 bg-surface px-4 py-3.5 sm:px-8">
          <div className="flex items-center gap-2 lg:hidden">
            <Logo size={26} />
            <span className="font-display text-base font-semibold tracking-tight text-ink">Gastify</span>
          </div>

          <div className="hidden items-center gap-1.5 text-sm text-muted lg:flex">
            <span>{ROL_LABEL[user.rol]}</span>
            <ChevronRight size={13} />
            {CurrentIcon && <CurrentIcon size={15} className="text-ink" />}
            <span className="font-medium text-ink">{current?.label ?? items[0]?.label}</span>
            <ChevronDown size={13} className="ml-0.5 text-muted" />
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <NotificationsBell />
            <div className="relative">
              <button onClick={() => setProfileOpen((v) => !v)} className="flex items-center gap-2.5">
                <span className="hidden text-sm font-medium text-ink sm:inline">{user.nombre}</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-rail text-xs font-semibold text-white">
                  {user.nombre.charAt(0).toUpperCase()}
                </span>
              </button>
              {profileOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                  <div className="absolute right-0 top-10 z-50 w-64 rounded-xl border border-ink/8 bg-surface p-4 shadow-xl">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rail text-sm font-semibold text-white">
                        {user.nombre.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">{user.nombre}</p>
                        <p className="truncate text-xs text-muted">{user.email}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-ink/8 pt-3 text-sm">
                      <span className="text-muted">Rol</span>
                      <span className="rounded-full bg-page px-2.5 py-1 text-xs font-medium text-ink">{ROL_LABEL[user.rol]}</span>
                    </div>
                    <button
                      onClick={logout}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-ink/12 py-2 text-sm font-semibold text-ink transition-colors hover:bg-page"
                    >
                      <LogOut size={15} /> Cerrar sesión
                    </button>
                  </div>
                </>
              )}
            </div>
            <button
              onClick={() => setDrawerOpen(true)}
              className="text-muted hover:text-ink lg:hidden"
              aria-label="Abrir menú"
            >
              <Menu size={20} strokeWidth={2} />
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
