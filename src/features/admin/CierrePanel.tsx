import { useCallback, useEffect, useState } from 'react'
import { apiGet, apiPost } from '../../data/api'
import { formatMoney } from '../../domain/buildProforma'
import {
  CAJA_DAY_IDS,
  CAJA_DAY_LABELS,
  CajaPanel,
  type CajaDayId,
} from './CajaPanel'

type ProductRow = { id: string; name: string; physicalStock: number }
type Account = { id: string; name: string; balance: number }

type ExpenseRow = {
  id: string
  description: string
  amount: number
  accountId: string
  category: string
  createdAt: string
}

/** Caja · Conteo · Movimientos · Cerrar (factura/resumen) */
type CierreSection = 'caja' | 'conteo' | 'movimientos' | 'cerrar'

const CIERRE_SECTION_KEY = 'lela-cierre-section'

const SECTION_OPTIONS: { id: CierreSection; label: string }[] = [
  { id: 'caja', label: 'Caja' },
  { id: 'conteo', label: 'Conteo' },
  { id: 'movimientos', label: 'Movimientos' },
  { id: 'cerrar', label: 'Cerrar' },
]

function emptyCounted(): Record<CajaDayId, number> {
  return {
    'acc-efectivo': 0,
    'acc-tarjeta': 0,
    'acc-sinpe': 0,
  }
}

function countedFromAccounts(accounts: Account[]): Record<CajaDayId, number> {
  const next = emptyCounted()
  for (const id of CAJA_DAY_IDS) {
    next[id] = accounts.find((a) => a.id === id)?.balance ?? 0
  }
  return next
}

function readStoredSection(): CierreSection {
  try {
    const raw = localStorage.getItem(CIERRE_SECTION_KEY)
    if (
      raw === 'caja' ||
      raw === 'conteo' ||
      raw === 'movimientos' ||
      raw === 'cerrar'
    ) {
      return raw
    }
  } catch {
    /* ignore */
  }
  return 'caja'
}

type CierrePanelProps = {
  openShift: { id: string; businessDate: string; openedAt?: string } | null
  products: ProductRow[]
  accounts: Account[]
  onSaved: () => void
  onMessage?: (msg: string) => void
}

export function CierrePanel({
  openShift,
  products,
  accounts,
  onSaved,
  onMessage,
}: CierrePanelProps) {
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [countedCash, setCountedCash] = useState<Record<CajaDayId, number>>(
    emptyCounted,
  )
  const [countedSeededFor, setCountedSeededFor] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [cajaRefresh, setCajaRefresh] = useState(0)
  const [expenses, setExpenses] = useState<ExpenseRow[]>([])
  const [section, setSection] = useState<CierreSection>(readStoredSection)

  useEffect(() => {
    try {
      localStorage.setItem(CIERRE_SECTION_KEY, section)
    } catch {
      /* ignore */
    }
  }, [section])

  useEffect(() => {
    void apiGet<{ ok: true; items: { id: string; name: string }[] }>(
      '/shifts/templates',
    ).then((t) => setTemplates(t.items))
  }, [])

  useEffect(() => {
    const key = openShift?.id ?? 'none'
    if (countedSeededFor === key || accounts.length === 0) return
    setCountedCash(countedFromAccounts(accounts))
    setCountedSeededFor(key)
  }, [accounts, openShift?.id, countedSeededFor])

  useEffect(() => {
    setCounts(
      Object.fromEntries(products.map((p) => [p.id, p.physicalStock])),
    )
  }, [products, openShift?.id])

  const loadExpenses = useCallback(async () => {
    try {
      const q = openShift?.openedAt
        ? `/expenses?since=${encodeURIComponent(openShift.openedAt)}`
        : '/expenses'
      const r = await apiGet<{ ok: true; items: ExpenseRow[] }>(q)
      setExpenses(r.items)
    } catch {
      setExpenses([])
    }
  }, [openShift?.openedAt])

  useEffect(() => {
    if (section !== 'cerrar') return
    void loadExpenses()
  }, [section, loadExpenses, cajaRefresh])

  function handleCajaSaved() {
    setCajaRefresh((n) => n + 1)
    onSaved()
  }

  async function openShiftAction(templateId: string, name: string) {
    setBusy(true)
    try {
      const r = await apiPost<{ ok: boolean; error?: string }>('/shifts/open', {
        templateId,
      })
      if (!r.ok) {
        onMessage?.(r.error ?? 'No se pudo abrir el turno')
        return
      }
      onMessage?.(`Turno ${name} abierto`)
      onSaved()
    } catch (err) {
      onMessage?.(err instanceof Error ? err.message : 'Error al abrir')
    } finally {
      setBusy(false)
    }
  }

  async function closeShift() {
    if (!openShift) return
    setBusy(true)
    try {
      const r = await apiPost<{ ok: boolean; differences?: number }>(
        `/shifts/${openShift.id}/close`,
        {
          countedCash: countedCash['acc-efectivo'],
          countedAccounts: countedCash,
          countedInventory: counts,
          notes: '',
        },
      )
      if (!r.ok) {
        onMessage?.('No se pudo cerrar el turno')
        return
      }
      onMessage?.(
        `Cierre guardado. Diferencias reportadas: ${r.differences ?? 0}`,
      )
      onSaved()
    } catch (err) {
      onMessage?.(err instanceof Error ? err.message : 'Error al cerrar')
    } finally {
      setBusy(false)
    }
  }

  const cajaRows = CAJA_DAY_IDS.map((id) => {
    const sistema = accounts.find((a) => a.id === id)?.balance ?? 0
    const contado = countedCash[id] ?? 0
    return {
      id,
      name: CAJA_DAY_LABELS[id],
      sistema,
      contado,
      diff: contado - sistema,
    }
  })

  const inventoryRows = products.map((p) => {
    const contado = counts[p.id] ?? 0
    return {
      id: p.id,
      name: p.name,
      sistema: p.physicalStock,
      contado,
      diff: contado - p.physicalStock,
    }
  })

  const inventoryDiffs = inventoryRows.filter((r) => r.diff !== 0)
  const cajaDiffs = cajaRows.filter((r) => Math.abs(r.diff) >= 0.01)
  const expensesTotal = expenses.reduce((s, e) => s + e.amount, 0)

  return (
    <section className="admin-dash">
      <label className="field__label" htmlFor="cierre-section">
        Apartado
      </label>
      <select
        id="cierre-section"
        className="field__input admin-nav__select"
        value={section}
        onChange={(e) => setSection(e.target.value as CierreSection)}
        style={{ marginBottom: '1rem' }}
      >
        {SECTION_OPTIONS.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>

      {section === 'caja' ? (
        <CajaPanel
          view="caja"
          accounts={accounts}
          counted={countedCash}
          onCountedChange={setCountedCash}
          sinceIso={openShift?.openedAt ?? null}
          refreshKey={cajaRefresh}
          onSaved={handleCajaSaved}
          onMessage={onMessage}
        />
      ) : null}

      {section === 'movimientos' ? (
        <CajaPanel
          view="movimientos"
          accounts={accounts}
          counted={countedCash}
          onCountedChange={setCountedCash}
          sinceIso={openShift?.openedAt ?? null}
          refreshKey={cajaRefresh}
          onSaved={handleCajaSaved}
          onMessage={onMessage}
        />
      ) : null}

      {section === 'conteo' ? (
        <div className="admin-dash__band">
          <h2 className="admin-dash__title">Conteo</h2>
          <p className="page__hint">
            Inventario físico vs sistema. Se incluye en la factura de cierre.
          </p>
          <div className="ds-table-wrap">
            <table className="ds-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="ds-table__num">Sistema</th>
                  <th className="ds-table__num">Contado</th>
                  <th className="ds-table__num">Diff</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const contado = counts[p.id] ?? 0
                  const diff = contado - p.physicalStock
                  return (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td className="ds-table__num">{p.physicalStock}</td>
                      <td className="ds-table__num">
                        <input
                          className="field__input"
                          style={{
                            maxWidth: '5.5rem',
                            minHeight: '2.35rem',
                            padding: '0.4rem 0.5rem',
                          }}
                          type="number"
                          value={contado}
                          onChange={(e) =>
                            setCounts({
                              ...counts,
                              [p.id]: Number(e.target.value),
                            })
                          }
                          aria-label={`Conteo de ${p.name}`}
                        />
                      </td>
                      <td className="ds-table__num">
                        {diff > 0 ? '+' : ''}
                        {diff}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {section === 'cerrar' ? (
        <div className="admin-dash__band admin-dash__band--cierre">
          {!openShift ? (
            <>
              <h2 className="admin-dash__title">Sin turno abierto</h2>
              <p className="page__hint">
                Abre un turno para poder emitir el cierre.
              </p>
              <div className="ds-toolbar__end" style={{ marginTop: '0.75rem' }}>
                {templates.length === 0 ? (
                  <p className="page__hint">No hay plantillas de turno.</p>
                ) : (
                  templates.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className="btn btn--primary"
                      disabled={busy}
                      onClick={() => void openShiftAction(t.id, t.name)}
                    >
                      Abrir {t.name}
                    </button>
                  ))
                )}
              </div>
            </>
          ) : (
            <>
              <h2 className="admin-dash__title">Factura de cierre</h2>
              <p className="page__hint">
                Turno {openShift.businessDate}
                {openShift.openedAt
                  ? ` · abierto ${new Date(openShift.openedAt).toLocaleString()}`
                  : ''}
                . Resumen de Caja, Conteo y Movimientos.
              </p>

              <h3 className="admin-dash__subtitle">Caja</h3>
              <div className="ds-table-wrap">
                <table className="ds-table">
                  <thead>
                    <tr>
                      <th>Medio</th>
                      <th className="ds-table__num">Sistema</th>
                      <th className="ds-table__num">Contado</th>
                      <th className="ds-table__num">Diff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cajaRows.map((a) => (
                      <tr key={a.id}>
                        <td>{a.name}</td>
                        <td className="ds-table__num">
                          {formatMoney(a.sistema)}
                        </td>
                        <td className="ds-table__num">
                          {formatMoney(a.contado)}
                        </td>
                        <td className="ds-table__num">
                          {a.diff > 0 ? '+' : ''}
                          {formatMoney(a.diff)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {cajaDiffs.length === 0 ? (
                <p className="page__hint">Caja cuadrada.</p>
              ) : (
                <p className="page__hint">
                  {cajaDiffs.length} medio(s) con diferencia.
                </p>
              )}

              <h3 className="admin-dash__subtitle">Conteo</h3>
              <div className="ds-table-wrap">
                <table className="ds-table">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th className="ds-table__num">Sistema</th>
                      <th className="ds-table__num">Contado</th>
                      <th className="ds-table__num">Diff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(inventoryDiffs.length > 0
                      ? inventoryDiffs
                      : inventoryRows
                    ).map((row) => (
                      <tr key={row.id}>
                        <td>{row.name}</td>
                        <td className="ds-table__num">{row.sistema}</td>
                        <td className="ds-table__num">{row.contado}</td>
                        <td className="ds-table__num">
                          {row.diff > 0 ? '+' : ''}
                          {row.diff}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {inventoryDiffs.length === 0 ? (
                <p className="page__hint">Inventario sin diferencias.</p>
              ) : (
                <p className="page__hint">
                  Mostrando {inventoryDiffs.length} producto(s) con diferencia.
                </p>
              )}

              <h3 className="admin-dash__subtitle">Movimientos</h3>
              <p className="admin-dash__stat">
                {expenses.length} movimiento(s) · −{formatMoney(expensesTotal)}
              </p>
              {expenses.length > 0 ? (
                <div className="ds-table-wrap">
                  <table className="ds-table">
                    <thead>
                      <tr>
                        <th>Descripción</th>
                        <th>Cuenta</th>
                        <th className="ds-table__num">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.map((e) => (
                        <tr key={e.id}>
                          <td>
                            {e.category ? `${e.category} · ` : ''}
                            {e.description}
                          </td>
                          <td>
                            {CAJA_DAY_LABELS[e.accountId as CajaDayId] ??
                              e.accountId}
                          </td>
                          <td className="ds-table__num">
                            −{formatMoney(e.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="page__hint">Sin movimientos en el turno.</p>
              )}

              <button
                type="button"
                className="btn btn--primary"
                style={{ marginTop: '1.25rem' }}
                disabled={busy}
                onClick={() => void closeShift()}
              >
                {busy ? 'Cerrando…' : 'Confirmar cierre'}
              </button>
            </>
          )}
        </div>
      ) : null}
    </section>
  )
}
