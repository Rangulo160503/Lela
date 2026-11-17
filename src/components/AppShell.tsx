import type { ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import {
  defaultCierrePath,
  defaultPathForArea,
  isCierrePath,
  isConfigPath,
  isDashboardPath,
} from '../features/admin/adminRoutes'
import { BrandMark } from './BrandMark'

type AppShellProps = {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const { user, isAdmin, logout } = useAuth()
  const location = useLocation()
  const hideChrome = location.pathname === '/login'

  if (hideChrome) return <>{children}</>

  return (
    <div className={`app-shell${isAdmin ? ' app-shell--admin' : ''}`}>
      <header className="app-masthead">
        <div className="app-masthead__brand">
          <BrandMark size={34} className="brand-mark brand-mark--mast" />
          <div>
            <p className="app-masthead__name">Panadería Lela</p>
            <p className="app-masthead__user">{user?.displayName}</p>
          </div>
        </div>
        <PrimaryNav className="app-masthead__nav" />
        <button
          type="button"
          className="app-masthead__logout"
          onClick={() => void logout()}
        >
          Salir
        </button>
      </header>
      <div className="app-shell__body">{children}</div>
      <PrimaryNav className="app-tabbar" />
    </div>
  )
}

function PrimaryNav({ className }: { className: string }) {
  const { isAdmin } = useAuth()
  const location = useLocation()
  const cierreActive = isCierrePath(location.pathname)
  const dashActive = isDashboardPath(location.pathname)
  const configActive = isConfigPath(location.pathname)

  return (
    <nav className={className} aria-label="Principal">
      <NavLink to="/facturacion" className={navClass}>
        <span className="mast-link__full">Facturación</span>
        <span className="mast-link__short" aria-hidden="true">
          Facturar
        </span>
      </NavLink>
      <NavLink to="/inventario" className={navClass}>
        Inventario
      </NavLink>
      <NavLink
        to={defaultCierrePath()}
        className={() =>
          cierreActive ? 'mast-link mast-link--active' : 'mast-link'
        }
      >
        Cierre
      </NavLink>
      {isAdmin ? (
        <>
          <NavLink
            to={defaultPathForArea('dashboard')}
            className={() =>
              dashActive ? 'mast-link mast-link--active' : 'mast-link'
            }
          >
            <span className="mast-link__full">Dashboard</span>
            <span className="mast-link__short" aria-hidden="true">
              Resumen
            </span>
          </NavLink>
          <NavLink
            to={defaultPathForArea('config')}
            className={() =>
              configActive ? 'mast-link mast-link--active' : 'mast-link'
            }
          >
            <span className="mast-link__full">Configuración</span>
            <span className="mast-link__short" aria-hidden="true">
              Config
            </span>
          </NavLink>
        </>
      ) : null}
    </nav>
  )
}

function navClass({ isActive }: { isActive: boolean }) {
  return isActive ? 'mast-link mast-link--active' : 'mast-link'
}
