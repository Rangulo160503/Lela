import { AuthProvider, useAuth } from './auth/AuthContext'
import { AppRouter } from './app/router'
import { AppShell } from './components/AppShell'
import { ServerStatusBanner } from './components/ServerStatusBanner'
import { InventoryProvider } from './features/inventario/InventoryContext'
import './index.css'
import './styles/base.css'

function AuthenticatedShell() {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <main className="page login-page">
        <p className="page__hint">Cargando sesión…</p>
      </main>
    )
  }
  if (!user) {
    return <AppRouter />
  }
  return (
    <InventoryProvider>
      <ServerStatusBanner />
      <AppShell>
        <AppRouter />
      </AppShell>
    </InventoryProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AuthenticatedShell />
    </AuthProvider>
  )
}
