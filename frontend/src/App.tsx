import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Gastos } from "./pages/Gastos";
import { Aprobaciones } from "./pages/Aprobaciones";
import { Equipo } from "./pages/Equipo";
import { SuperAdminHome } from "./pages/SuperAdminHome";
import { Configuracion } from "./pages/Configuracion";
import { Subir } from "./pages/Subir";
import { Invitacion } from "./pages/Invitacion";

function ProtectedLayout() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Layout />;
}

// /subir vive fuera del Layout a propósito: es una pantalla completa de celular, sin barra
// lateral ni navegación. El empleado la abre desde su pantalla de inicio y solo ve el botón.
function ProtectedSubir() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Subir />;
}

// Every role has a different "front page": the platform owner manages companies,
// an aprobador's job starts and ends at the approval queue, everyone else gets the spend summary.
function Home() {
  const { user } = useAuth();
  if (user?.rol === "super_admin") return <SuperAdminHome />;
  if (user?.rol === "aprobador") return <Navigate to="/aprobaciones" replace />;
  if (user?.rol === "empleado") return <Navigate to="/subir" replace />;
  return <Dashboard />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/invitacion" element={<Invitacion />} />
          <Route path="/subir" element={<ProtectedSubir />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/gastos" element={<Gastos />} />
            <Route path="/aprobaciones" element={<Aprobaciones />} />
            <Route path="/equipo" element={<Equipo />} />
            <Route path="/configuracion" element={<Configuracion />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
