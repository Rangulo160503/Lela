import { useCallback, useEffect, useState } from 'react'
import { PhotoCaptureField } from '../../components/PhotoCaptureField'
import { apiGet, apiPost } from '../../data/api'
import { formatMoney } from '../../domain/buildProforma'
import { AdminDrawer } from './AdminDrawer'

type Account = { id: string; name: string; balance: number }

export const CAJA_DAY_IDS = ['acc-efectivo', 'acc-tarjeta', 'acc-sinpe'] as const
export type CajaDayId = (typeof CAJA_DAY_IDS)[number]

export const CAJA_DAY_LABELS: Record<CajaDayId, string> = {
  'acc-efectivo': 'Efectivo',
  'acc-tarjeta': 'Tarjetas',
  'acc-sinpe': 'SINPE',
}

const MOVEMENT_TYPES = [
  { id: 'gasto', label: 'Gasto' },
  { id: 'factura', label: 'Factura' },
  { id: 'compra', label: 'Compra / insumos' },
  { id: 'servicio', label: 'Servicio' },
  { id: 'otro', label: 'Otro' },
] as const

type ExpenseRow = {
  id: string
  description: string
  amount: number
  accountId: string
  category: string
  photoPath?: string | null
  createdAt: string
}

type CajaPanelProps = {
  /** `caja` = sistema vs contado; `movimientos` = lista + alta */
  view: 'caja' | 'movimientos'
  accounts: Account[]
  counted: Record<CajaDayId, number>
  onCountedChange: (next: Record<CajaDayId, number>) => void
  sinceIso?: string | null
  refreshKey?: number
  onSaved: () => void
  onMessage?: (msg: string) => void
}

export function CajaPanel({
  view,
  accounts,
  counted,
  onCountedChange,
  sinceIso,
  refreshKey = 0,
  onSaved,
  onMessage,
}: CajaPanelProps) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [expenses, setExpenses] = useState<ExpenseRow[]>([])
  const [form, setForm] = useState({
    category: 'gasto',
    description: '',
    amount: 0,
    accountId: 'acc-efectivo' as CajaDayId,
    photoPath: '',
  })

  const loadExpenses = useCallback(async () => {
    try {
      const q = sinceIso
        ? `/expenses?since=${encodeURIComponent(sinceIso)}`
        : '/expenses'
      const r = await apiGet<{ ok: true; items: ExpenseRow[] }>(q)
      setExpenses(r.items)
    } catch {
      setExpenses([])
    }
  }, [sinceIso])

  useEffect(() => {
    if (view !== 'movimientos') return
    void loadExpenses()
  }, [loadExpenses, refreshKey, view])

  const dayAccounts = CAJA_DAY_IDS.map((id) => {
    const found = accounts.find((a) => a.id === id)
    const sistema = found?.balance ?? 0
    const contado = counted[id] ?? 0
    const diff = contado - sistema
    return {
      id,
      name: CAJA_DAY_LABELS[id],
      sistema,
      contado,
      diff,
    }
  })

  function closeForm() {
    setOpen(false)
    setForm({
      category: 'gasto',
      description: '',
      amount: 0,
      accountId: 'acc-efectivo',
      photoPath: '',
    })
  }

  async function save() {
    if (!form.description.trim()) {
      onMessage?.('Describe el movimiento')
      return
    }
    if (form.amount <= 0) {
      onMessage?.('Indica un monto válido')
      return
    }
    setSaving(true)
    try {
      await apiPost('/expenses', {
        description: form.description.trim(),
        amount: form.amount,
        accountId: form.accountId,
        category: form.category,
        photoPath: form.photoPath || undefined,
      })
      onCountedChange({
        ...counted,
        [form.accountId]: Math.max(
          0,
          (counted[form.accountId] ?? 0) - form.amount,
        ),
      })
      closeForm()
      await loadExpenses()
      onSaved()
    } catch (err) {
      onMessage?.(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  const categoryLabel = (id: string) =>
    MOVEMENT_TYPES.find((t) => t.id === id)?.label ?? id

  if (view === 'caja') {
    return (
      <section className="admin-panel">
        <div className="ds-toolbar">
          <h2 className="ds-toolbar__title">Caja</h2>
        </div>
        <p className="page__hint">
          Sistema = ventas y movimientos. Contado = cajón / datáfono / SINPE.
        </p>
        <div className="ds-table-wrap">
          <table className="ds-table">
            <thead>
              <tr>
                <th>Medio</th>
                <th className="ds-table__num">Sistema</th>
                <th className="ds-table__num">Contado</th>
                <th className="ds-table__num">Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {dayAccounts.map((a) => (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td className="ds-table__num">{formatMoney(a.sistema)}</td>
                  <td className="ds-table__num">
                    <input
                      className="field__input"
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      value={a.contado}
                      onChange={(e) =>
                        onCountedChange({
                          ...counted,
                          [a.id]: Number(e.target.value),
                        })
                      }
                      aria-label={`Contado ${a.name}`}
                    />
                  </td>
                  <td
                    className="ds-table__num"
                    style={{
                      color:
                        Math.abs(a.diff) < 0.01
                          ? undefined
                          : a.diff < 0
                            ? 'var(--danger, #b42318)'
                            : 'var(--ok, #067647)',
                      fontWeight: 600,
                    }}
                  >
                    {a.diff > 0 ? '+' : ''}
                    {formatMoney(a.diff)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    )
  }

  return (
    <section className="admin-panel">
      <div className="ds-toolbar">
        <h2 className="ds-toolbar__title">Movimientos</h2>
        <div className="ds-toolbar__end">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setOpen(true)}
          >
            Nuevo
          </button>
        </div>
      </div>

      <p className="page__hint">
        Gastos, facturas y salidas de efectivo, tarjeta o SINPE.
      </p>

      {expenses.length === 0 ? (
        <p className="ds-empty">Sin movimientos registrados.</p>
      ) : (
        <div className="ds-table-wrap">
          <table className="ds-table">
            <thead>
              <tr>
                <th>Hora</th>
                <th>Tipo</th>
                <th>Descripción</th>
                <th>Cuenta</th>
                <th className="ds-table__num">Monto</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id}>
                  <td>
                    {e.createdAt
                      ? new Date(e.createdAt).toLocaleString()
                      : '—'}
                  </td>
                  <td>{categoryLabel(e.category)}</td>
                  <td>{e.description}</td>
                  <td>
                    {CAJA_DAY_LABELS[e.accountId as CajaDayId] ?? e.accountId}
                  </td>
                  <td className="ds-table__num">−{formatMoney(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AdminDrawer
        open={open}
        title="Nuevo movimiento"
        onClose={closeForm}
        footer={
          <div className="admin-form__actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={closeForm}
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => void save()}
              disabled={saving}
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        }
      >
        <div className="admin-form">
          <label className="field" htmlFor="mov-category">
            <span className="field__label">Clasificación</span>
            <select
              id="mov-category"
              className="field__input"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {MOVEMENT_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field__label">Descripción</span>
            <input
              className="field__input"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              autoComplete="off"
            />
          </label>
          <div className="admin-form__row">
            <label className="field">
              <span className="field__label">Monto</span>
              <input
                className="field__input"
                type="number"
                inputMode="decimal"
                value={form.amount}
                onChange={(e) =>
                  setForm({ ...form, amount: Number(e.target.value) })
                }
              />
            </label>
            <label className="field">
              <span className="field__label">Cuenta</span>
              <select
                className="field__input"
                value={form.accountId}
                onChange={(e) =>
                  setForm({ ...form, accountId: e.target.value as CajaDayId })
                }
              >
                {CAJA_DAY_IDS.map((id) => (
                  <option key={id} value={id}>
                    {CAJA_DAY_LABELS[id]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <PhotoCaptureField
            label="Foto (opcional)"
            kind="expense"
            value={form.photoPath}
            onChange={(photoPath) => setForm({ ...form, photoPath })}
            onError={onMessage}
          />
        </div>
      </AdminDrawer>
    </section>
  )
}
