import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { VerifyMagicLink } from "./pages/VerifyMagicLink";
import { Dashboard } from "./pages/Dashboard";
import { Gastos } from "./pages/Gastos";
import { Aprobaciones } from "./pages/Aprobaciones";
import { Equipo } from "./pages/Equipo";
import { SuperAdminHome } from "./pages/SuperAdminHome";

function ProtectedLayout() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Layout />;
}

// Every role has a different "front page": the platform owner manages companies,
// an aprobador's job starts and ends at the approval queue, everyone else gets the spend summary.
function Home() {
  const { user } = useAuth();
  if (user?.rol === "super_admin") return <SuperAdminHome />;
  if (user?.rol === "aprobador") return <Navigate to="/aprobaciones" replace />;
  return <Dashboard />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/auth/verify" element={<VerifyMagicLink />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/gastos" element={<Gastos />} />
            <Route path="/aprobaciones" element={<Aprobaciones />} />
            <Route path="/equipo" element={<Equipo />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
