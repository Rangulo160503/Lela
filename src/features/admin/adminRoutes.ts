export type AdminTabId =
  | 'cierre'
  | 'dashboard'
  | 'products'
  | 'materials'
  | 'recipes'
  | 'promos'
  | 'photos'
  | 'suppliers'
  | 'proposals'
  | 'users'
  | 'printer'
  | 'backups'

export type AdminArea = 'cierre' | 'dashboard' | 'config'

export type AdminNavItem = {
  id: AdminTabId
  label: string
  path: string
}

/** Cierre: una sola pantalla (abrir + cerrar turno). */
export const CIERRE_ITEMS: AdminNavItem[] = [
  { id: 'cierre', label: 'Cierre', path: '/admin' },
]

export const DASHBOARD_ITEMS: AdminNavItem[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/admin/dashboard' },
]

export const CONFIG_ITEMS: AdminNavItem[] = [
  { id: 'products', label: 'Catálogo', path: '/admin/config/catalogo' },
  { id: 'promos', label: 'Combos', path: '/admin/config/combos' },
  { id: 'materials', label: 'Materia prima', path: '/admin/config/materia-prima' },
  { id: 'recipes', label: 'Recetas', path: '/admin/config/recetas' },
  { id: 'photos', label: 'Fotos', path: '/admin/config/fotos' },
  { id: 'suppliers', label: 'Proveedores', path: '/admin/config/proveedores' },
  { id: 'proposals', label: 'Aprobaciones', path: '/admin/config/aprobaciones' },
  { id: 'users', label: 'Usuarios', path: '/admin/config/usuarios' },
  { id: 'printer', label: 'Impresora', path: '/admin/config/impresora' },
  { id: 'backups', label: 'Respaldos', path: '/admin/config/respaldos' },
]

const ALL_ITEMS = [...CIERRE_ITEMS, ...DASHBOARD_ITEMS, ...CONFIG_ITEMS]

const PATH_ALIASES: Record<string, string> = {
  '/admin/': '/admin',
  '/admin/cierre': '/admin',
  '/admin/turnos': '/admin',
  '/admin/resumen': '/admin',
  '/admin/config': '/admin/config/catalogo',
  '/admin/config/': '/admin/config/catalogo',
  '/admin/catalogo': '/admin/config/catalogo',
  '/admin/config/catalogo': '/admin/config/catalogo',
  '/admin/combos': '/admin/config/combos',
  '/admin/caja': '/admin',
  '/admin/config/caja': '/admin',
  '/admin/products': '/admin/config/catalogo',
  '/admin/aprobaciones': '/admin/config/aprobaciones',
  '/admin/compras': '/admin',
  '/admin/facturas': '/admin',
}

export function normalizeAdminPath(pathname: string): string {
  const clean = pathname.replace(/\/+$/, '') || '/admin'
  return PATH_ALIASES[pathname] ?? PATH_ALIASES[clean] ?? clean
}

export function tabFromPath(pathname: string): AdminTabId {
  const path = normalizeAdminPath(pathname)
  const hit = ALL_ITEMS.find((item) => item.path === path)
  return hit?.id ?? 'cierre'
}

export function pathFromTab(tab: AdminTabId): string {
  return ALL_ITEMS.find((item) => item.id === tab)?.path ?? '/admin'
}

export function areaFromTab(tab: AdminTabId): AdminArea {
  if (tab === 'cierre') return 'cierre'
  if (tab === 'dashboard') return 'dashboard'
  return 'config'
}

export function itemsForArea(area: AdminArea): AdminNavItem[] {
  if (area === 'cierre') return CIERRE_ITEMS
  if (area === 'dashboard') return DASHBOARD_ITEMS
  return CONFIG_ITEMS
}

const AREA_MEMORY_KEY = 'lela-admin-area-paths'

function readAreaMemory(): Partial<Record<AdminArea, string>> {
  try {
    const raw = localStorage.getItem(AREA_MEMORY_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Partial<Record<AdminArea, string>>
  } catch {
    return {}
  }
}

export function rememberAreaPath(area: AdminArea, path: string): void {
  const items = itemsForArea(area)
  if (!items.some((item) => item.path === path)) return
  const next = { ...readAreaMemory(), [area]: path }
  try {
    localStorage.setItem(AREA_MEMORY_KEY, JSON.stringify(next))
  } catch {
    /* ignore quota */
  }
}

export function defaultPathForArea(area: AdminArea): string {
  const fallback =
    area === 'cierre'
      ? '/admin'
      : area === 'dashboard'
        ? '/admin/dashboard'
        : '/admin/config/catalogo'
  const remembered = readAreaMemory()[area]
  if (remembered && itemsForArea(area).some((item) => item.path === remembered)) {
    return remembered
  }
  return fallback
}

export function defaultCierrePath(): string {
  return '/admin'
}

export function isCierrePath(pathname: string): boolean {
  const path = normalizeAdminPath(pathname)
  return path === '/admin'
}

export function isDashboardPath(pathname: string): boolean {
  return normalizeAdminPath(pathname) === '/admin/dashboard'
}

export function isConfigPath(pathname: string): boolean {
  return normalizeAdminPath(pathname).startsWith('/admin/config')
}

export function areaTitle(area: AdminArea): string {
  if (area === 'cierre') return 'Cierre'
  if (area === 'dashboard') return 'Dashboard'
  return 'Configuración'
}

export function areaLede(area: AdminArea): string {
  if (area === 'cierre') {
    return 'Caja del día, abrir turno y cerrar con conteo de productos.'
  }
  if (area === 'dashboard') {
    return 'Elige un turno para ver su resumen de actividad y caja.'
  }
  return 'Catálogo, combos, fotos, maestros, usuarios y respaldos.'
}

export function areaMeta(area: AdminArea): string {
  if (area === 'cierre') return 'Apertura y cierre de turno'
  if (area === 'dashboard') return 'Resumen por turno'
  return 'Maestros y parámetros del negocio'
}
