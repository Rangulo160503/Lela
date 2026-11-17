import { Link } from 'react-router'
import {
  areaFromTab,
  itemsForArea,
  pathFromTab,
  rememberAreaPath,
  type AdminTabId,
} from './adminRoutes'

export type { AdminTabId }

type AdminNavProps = {
  tab: AdminTabId
  onNavigate: (path: string) => void
}

/** Ya no hay switcher Cierre/Trabajo — Cierre y Dashboard son top-level. */
export function AdminAreaSwitch(_props: { tab: AdminTabId }) {
  return null
}

export function AdminNav({ tab, onNavigate }: AdminNavProps) {
  const area = areaFromTab(tab)
  if (area !== 'config') return null

  const secondary = itemsForArea('config')
  const currentPath = pathFromTab(tab)

  function go(path: string) {
    rememberAreaPath('config', path)
    onNavigate(path)
  }

  return (
    <nav className="admin-nav" aria-label="Secciones">
      <p className="admin-nav__label">Secciones</p>

      <label className="admin-nav__mobile">
        <span className="admin-nav__mobile-label">Ir a</span>
        <select
          className="admin-nav__select field__input"
          value={currentPath}
          onChange={(e) => go(e.target.value)}
        >
          {secondary.map((item) => (
            <option key={item.id} value={item.path}>
              {item.label}
            </option>
          ))}
        </select>
      </label>

      <div className="admin-nav__groups">
        <div className="admin-nav__group">
          {secondary.map((item) => (
            <Link
              key={item.id}
              to={item.path}
              onClick={() => rememberAreaPath('config', item.path)}
              className={
                tab === item.id
                  ? 'admin-nav__link admin-nav__link--active'
                  : 'admin-nav__link'
              }
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
}
