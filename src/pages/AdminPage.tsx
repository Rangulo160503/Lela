import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { apiGet, apiPost, fetchSnapshot } from '../data/api'
import { AdminNav } from '../features/admin/AdminNav'
import {
  areaFromTab,
  areaLede,
  areaTitle,
  normalizeAdminPath,
  pathFromTab,
  rememberAreaPath,
  tabFromPath,
} from '../features/admin/adminRoutes'
import { BackupsPanel } from '../features/admin/BackupsPanel'
import { CierrePanel } from '../features/admin/CierrePanel'
import { MaterialsPanel } from '../features/admin/MaterialsPanel'
import { PrinterPanel } from '../features/admin/PrinterPanel'
import { ProductsPanel } from '../features/admin/ProductsPanel'
import { PromosPanel } from '../features/admin/PromosPanel'
import { ProposalsPanel } from '../features/admin/ProposalsPanel'
import { RecipesPanel } from '../features/admin/RecipesPanel'
import { ShiftDashboardPanel } from '../features/admin/ShiftDashboardPanel'
import { SuppliersPanel } from '../features/admin/SuppliersPanel'
import { UsersPanel } from '../features/admin/UsersPanel'

export function AdminPage() {
  const { isAdmin } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const tab = tabFromPath(location.pathname)
  const area = areaFromTab(tab)
  const [users, setUsers] = useState<unknown[]>([])
  const [products, setProducts] = useState<unknown[]>([])
  const [materials, setMaterials] = useState<unknown[]>([])
  const [recipes, setRecipes] = useState<unknown[]>([])
  const [suppliers, setSuppliers] = useState<unknown[]>([])
  const [accounts, setAccounts] = useState<
    { id: string; name: string; balance: number }[]
  >([])
  const [proposals, setProposals] = useState<
    {
      id: string
      title: string
      status: string
      items: { id: string; label: string; status: string }[]
    }[]
  >([])
  const [promos, setPromos] = useState<unknown[]>([])
  const [backups, setBackups] = useState<
    { id: string; path: string; createdAt: string; kind: string }[]
  >([])
  const [printers, setPrinters] = useState<string[]>([])
  const [printerName, setPrinterName] = useState('')
  const [paperChars, setPaperChars] = useState(40)
  const [printerHint, setPrinterHint] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [openShift, setOpenShift] = useState<{
    id: string
    businessDate: string
    openedAt?: string
  } | null>(null)

  async function refresh() {
    try {
      if (tab === 'cierre') {
        const s = await apiGet<{
          ok: true
          open: {
            id: string
            businessDate: string
            openedAt?: string
          } | null
        }>('/shifts')
        setOpenShift(s.open)
        if (isAdmin) {
          const p = await apiGet<{ ok: true; products: unknown[] }>(
            '/admin/products',
          )
          setProducts(p.products)
        } else {
          const snap = await fetchSnapshot()
          setProducts(snap.products)
        }
        const a = await apiGet<{
          ok: true
          items: { id: string; name: string; balance: number }[]
        }>('/accounts')
        setAccounts(a.items)
        return
      }
      if (!isAdmin) return
      if (tab === 'dashboard') {
        const p = await apiGet<{ ok: true; products: unknown[] }>(
          '/admin/products',
        )
        setProducts(p.products)
      }
      if (tab === 'users') {
        const u = await apiGet<{ ok: true; users: unknown[] }>('/users')
        setUsers(u.users)
      }
      if (tab === 'products') {
        const p = await apiGet<{ ok: true; products: unknown[] }>(
          '/admin/products',
        )
        setProducts(p.products)
      }
      if (tab === 'materials' || tab === 'recipes') {
        const m = await apiGet<{ ok: true; items: unknown[] }>('/raw-materials')
        setMaterials(m.items)
      }
      if (tab === 'recipes') {
        const r = await apiGet<{ ok: true; items: unknown[] }>('/recipes')
        setRecipes(r.items)
        const p = await apiGet<{ ok: true; products: unknown[] }>(
          '/admin/products',
        )
        setProducts(p.products)
      }
      if (tab === 'suppliers') {
        const s = await apiGet<{ ok: true; items: unknown[] }>('/suppliers')
        setSuppliers(s.items)
      }
      if (tab === 'proposals') {
        const p = await apiGet<{
          ok: true
          items: {
            id: string
            title: string
            status: string
            items: { id: string; label: string; status: string }[]
          }[]
        }>('/proposals')
        setProposals(p.items)
      }
      if (tab === 'promos') {
        const p = await apiGet<{ ok: true; items: unknown[] }>('/promos')
        setPromos(p.items)
        const prod = await apiGet<{ ok: true; products: unknown[] }>(
          '/admin/products',
        )
        setProducts(prod.products)
      }
      if (tab === 'backups') {
        const b = await apiGet<{
          ok: true
          items: { id: string; path: string; createdAt: string; kind: string }[]
        }>('/backups')
        setBackups(b.items)
      }
      if (tab === 'printer') {
        const pr = await apiGet<{
          ok: true
          printers: string[]
          settings: { printerName: string; paperChars: number }
          hint: string
        }>('/printer')
        setPrinters(pr.printers)
        setPrinterName(pr.settings.printerName)
        setPaperChars(pr.settings.paperChars)
        setPrinterHint(pr.hint)
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Error al cargar')
    }
  }

  useEffect(() => {
    const normalized = normalizeAdminPath(location.pathname)
    if (normalized !== location.pathname) {
      navigate(normalized, { replace: true })
      return
    }
    rememberAreaPath(areaFromTab(tab), pathFromTab(tab))
  }, [location.pathname, navigate, tab])

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, isAdmin])

  if (!isAdmin && area !== 'cierre') {
    return <Navigate to="/admin" replace />
  }

  const productNames = Object.fromEntries(
    (
      products as { id: string; name: string }[]
    ).map((p) => [p.id, p.name]),
  )

  return (
    <main className="page page--wide admin-page page--editorial">
      <header className="module-head module-head--admin admin-page__intro">
        <div className="module-head__copy">
          <h1 className="module-head__title">{areaTitle(area)}</h1>
          <p className="module-head__lede ops-hide-mobile">{areaLede(area)}</p>
        </div>
      </header>

      {message ? <p className="login-form__error">{message}</p> : null}

      <div className="admin-layout">
        <AdminNav tab={tab} onNavigate={(path) => navigate(path)} />

        <div className="admin-main">
          {tab === 'cierre' ? (
            <CierrePanel
              openShift={openShift}
              products={
                products as {
                  id: string
                  name: string
                  physicalStock: number
                }[]
              }
              accounts={accounts}
              onSaved={() => void refresh()}
              onMessage={setMessage}
            />
          ) : null}

          {tab === 'dashboard' ? (
            <ShiftDashboardPanel productNames={productNames} />
          ) : null}

          {tab === 'products' ? (
            <ProductsPanel
              products={
                products as {
                  id: string
                  name: string
                  unitPrice: number
                  physicalStock: number
                  presentationName?: string
                  description?: string
                  photoPath?: string | null
                }[]
              }
              onSaved={() => void refresh()}
              onMessage={setMessage}
            />
          ) : null}

          {tab === 'materials' ? (
            <MaterialsPanel
              materials={
                materials as {
                  id: string
                  name: string
                  unit: string
                  stock: number
                }[]
              }
              onSaved={() => void refresh()}
            />
          ) : null}

          {tab === 'recipes' ? (
            <RecipesPanel
              recipes={
                recipes as { id: string; name: string; version: number }[]
              }
              products={products as { id: string; name: string }[]}
              materials={materials as { id: string; name: string }[]}
              onSaved={() => void refresh()}
            />
          ) : null}

          {tab === 'promos' ? (
            <PromosPanel
              promos={promos as { id: string; name: string; price: number }[]}
              products={products as { id: string; name: string }[]}
              onSaved={() => void refresh()}
            />
          ) : null}

          {tab === 'suppliers' ? (
            <SuppliersPanel
              suppliers={
                suppliers as { id: string; name: string; phone: string }[]
              }
              onSaved={() => void refresh()}
            />
          ) : null}

          {tab === 'proposals' ? (
            <ProposalsPanel
              proposals={proposals}
              onSaved={() => void refresh()}
            />
          ) : null}

          {tab === 'users' ? (
            <UsersPanel
              users={
                users as {
                  id: string
                  username: string
                  displayName: string
                  role: string
                  active: boolean
                }[]
              }
              onSaved={() => void refresh()}
            />
          ) : null}

          {tab === 'printer' ? (
            <PrinterPanel
              printers={printers}
              printerName={printerName}
              paperChars={paperChars}
              printerHint={printerHint}
              onPrinterName={setPrinterName}
              onPaperChars={setPaperChars}
              onSave={async () => {
                await apiPost('/printer', { printerName, paperChars })
                setMessage('Impresora guardada')
              }}
            />
          ) : null}

          {tab === 'backups' ? (
            <BackupsPanel
              backups={backups}
              onSaved={() => void refresh()}
              onMessage={setMessage}
            />
          ) : null}
        </div>
      </div>
    </main>
  )
}
