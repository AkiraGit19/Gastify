import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { VerifyMagicLink } from "./pages/VerifyMagicLink";
import { Dashboard } from "./pages/Dashboard";
import { Gastos } from "./pages/Gastos";
import { Aprobaciones } from "./pages/Aprobaciones";
import { Equipo } from "./pages/Equipo";
import { Empresas } from "./pages/Empresas";

function ProtectedLayout() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Layout />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/auth/verify" element={<VerifyMagicLink />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/gastos" element={<Gastos />} />
            <Route path="/aprobaciones" element={<Aprobaciones />} />
            <Route path="/equipo" element={<Equipo />} />
            <Route path="/empresas" element={<Empresas />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
