import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { AdminPage } from '../pages/AdminPage'
import { FacturacionPage } from '../pages/FacturacionPage'
import { InventarioPage } from '../pages/InventarioPage'
import { LoginPage } from '../pages/LoginPage'
import { TurnosPage } from '../pages/TurnosPage'

function Private({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <main className="page">Cargando…</main>
  if (!user) return <Navigate to="/login" replace />
  return children
}

/** Default landing: empleado → facturación; admin/principal → admin */
function RoleHomeRedirect() {
  const { isAdmin, loading, user } = useAuth()
  if (loading) return <main className="page">Cargando…</main>
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={isAdmin ? '/admin' : '/facturacion'} replace />
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <Private>
            <RoleHomeRedirect />
          </Private>
        }
      />
      <Route
        path="/facturacion"
        element={
          <Private>
            <FacturacionPage />
          </Private>
        }
      />
      <Route
        path="/inventario"
        element={
          <Private>
            <InventarioPage />
          </Private>
        }
      />
      <Route
        path="/turnos"
        element={
          <Private>
            <TurnosPage />
          </Private>
        }
      />
      <Route
        path="/admin/*"
        element={
          <Private>
            <AdminPage />
          </Private>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
