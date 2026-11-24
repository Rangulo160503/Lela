import { useCallback, useEffect, useState } from 'react'
import { SoftToast } from '../../components/SoftToast'
import { apiGet } from '../../data/api'
import { formatMoney } from '../../domain/buildProforma'

type ShiftRow = {
  id: string
  businessDate: string
  status: string
  openedAt?: string
  closedAt?: string | null
  expectedCash?: number | null
  countedCash?: number | null
}

type ShiftSummary = {
  shift: {
    id: string
    businessDate: string
    status: string
    openedAt: string
    closedAt: string | null
    expectedCash: number | null
    countedCash: number | null
    notes: string
  }
  salesCount: number
  salesTotal: number
  byMethod: Record<string, number>
  accounts: { id: string; name: string; balance: number }[]
  expectedAccounts?: Record<string, number>
  countedAccounts?: Record<string, number>
  mermaCount: number
  exitsCount: number
  productionCount: number
  expensesCount: number
  expenses?: {
    id: string
    description: string
    amount: number
    accountId: string
    category: string
    createdAt: string
  }[]
  expectedInventory: Record<string, number>
  countedInventory: Record<string, number>
  live: boolean
}

const CAJA_DAY_IDS = ['acc-efectivo', 'acc-tarjeta', 'acc-sinpe'] as const
const CAJA_DAY_LABELS: Record<string, string> = {
  'acc-efectivo': 'Efectivo',
  'acc-tarjeta': 'Tarjetas',
  'acc-sinpe': 'SINPE',
}

const CUMULATIVE_IDS = ['acc-banco', 'acc-fuerte'] as const
const CUMULATIVE_LABELS: Record<string, string> = {
  'acc-banco': 'Cuenta bancaria',
  'acc-fuerte': 'Caja fuerte',
}

type ShiftDashboardPanelProps = {
  productNames?: Record<string, string>
}

export function ShiftDashboardPanel({ productNames = {} }: ShiftDashboardPanelProps) {
  const [shifts, setShifts] = useState<ShiftRow[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [summary, setSummary] = useState<ShiftSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const dismissError = useCallback(() => setError(null), [])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const r = await apiGet<{ ok: true; items: ShiftRow[] }>('/shifts')
        setShifts(r.items)
        if (r.items.length && !selectedId) {
          setSelectedId(r.items[0].id)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudieron cargar turnos')
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!selectedId) {
      setSummary(null)
      return
    }
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const r = await apiGet<{ ok: true; data: ShiftSummary } | { ok: false; error: string }>(
          `/shifts/${selectedId}/summary`,
        )
        if (cancelled) return
        if (!r.ok) {
          setSummary(null)
          setError('Turno no encontrado')
          return
        }
        setSummary(r.data)
      } catch (err) {
        if (!cancelled) {
          setSummary(null)
          setError(err instanceof Error ? err.message : 'Error al cargar resumen')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedId])

  const cajaDia =
    summary?.accounts
      .filter((a) => (CAJA_DAY_IDS as readonly string[]).includes(a.id))
      .map((a) => ({
        ...a,
        name: CAJA_DAY_LABELS[a.id] ?? a.name,
      })) ?? []

  const cumulative =
    summary?.accounts
      .filter((a) => (CUMULATIVE_IDS as readonly string[]).includes(a.id))
      .map((a) => ({
        ...a,
        name: CUMULATIVE_LABELS[a.id] ?? a.name,
      })) ?? []

  const inventoryRows = summary
    ? Object.keys({
        ...summary.expectedInventory,
        ...summary.countedInventory,
      })
        .map((id) => {
          const expected = summary.expectedInventory[id] ?? 0
          const counted = summary.countedInventory[id]
          const hasCounted = counted != null
          return {
            id,
            name: productNames[id] ?? id,
            expected,
            counted,
            hasCounted,
            diff: hasCounted ? counted - expected : null,
          }
        })
        .sort((a, b) => a.name.localeCompare(b.name, 'es'))
    : []

  const inventoryDiffs = inventoryRows.filter(
    (r) => r.diff != null && r.diff !== 0,
  )

  return (
    <section className="admin-dash">
      <div className="admin-dash__band">
        <h2 className="admin-dash__title">Turno</h2>
        {shifts.length === 0 ? (
          <p className="page__hint">Aún no hay turnos. Ábrelos en Cierre.</p>
        ) : (
          <label className="field__label" htmlFor="dash-shift-select">
            Escoger turno
            <select
              id="dash-shift-select"
              className="field__input"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              style={{ marginTop: '0.35rem' }}
            >
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.businessDate} · {s.status}
                  {s.expectedCash != null
                    ? ` · esp. ${formatMoney(s.expectedCash)}`
                    : ''}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <SoftToast message={error} tone="error" onDismiss={dismissError} />
      {loading ? <p className="page__hint">Cargando resumen…</p> : null}

      {summary && !loading ? (
        <>
          <div className="admin-dash__band">
            <h2 className="admin-dash__title">Resumen del turno</h2>
            <p className="page__hint">
              {summary.shift.businessDate} · {summary.shift.status}
              {summary.live ? ' · en vivo' : ' · cerrado'}
              {summary.shift.openedAt
                ? ` · abierto ${new Date(summary.shift.openedAt).toLocaleString()}`
                : ''}
              {summary.shift.closedAt
                ? ` · cerrado ${new Date(summary.shift.closedAt).toLocaleString()}`
                : ''}
            </p>
            <ul className="admin-dash__list">
              <li>
                <span>Efectivo esperado</span>
                <strong>
                  {summary.shift.expectedCash != null
                    ? formatMoney(summary.shift.expectedCash)
                    : '—'}
                </strong>
              </li>
              <li>
                <span>Efectivo contado</span>
                <strong>
                  {summary.shift.countedCash != null
                    ? formatMoney(summary.shift.countedCash)
                    : '—'}
                </strong>
              </li>
            </ul>
          </div>

          <div className="admin-dash__band">
            <h2 className="admin-dash__title">Actividad</h2>
            <p className="admin-dash__stat">
              {summary.salesCount} ventas · {formatMoney(summary.salesTotal)}
            </p>
            <ul className="admin-dash__list">
              {Object.entries(summary.byMethod).map(([k, v]) => (
                <li key={k}>
                  <span>{k}</span>
                  <strong>{formatMoney(v)}</strong>
                </li>
              ))}
              <li>
                <span>Producción / entradas</span>
                <strong>{summary.productionCount}</strong>
              </li>
              <li>
                <span>Mermas / salidas</span>
                <strong>{summary.mermaCount + summary.exitsCount}</strong>
              </li>
              <li>
                <span>Movimientos de caja</span>
                <strong>{summary.expensesCount}</strong>
              </li>
            </ul>

            {cajaDia.length > 0 ? (
              <>
                <h3 className="admin-dash__subtitle">Caja del turno</h3>
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
                      {cajaDia.map((a) => {
                        const sistema =
                          summary.expectedAccounts?.[a.id] ?? a.balance
                        const contado = summary.countedAccounts?.[a.id]
                        const diff =
                          contado != null ? contado - sistema : null
                        return (
                          <tr key={a.id}>
                            <td>{a.name}</td>
                            <td className="ds-table__num">
                              {formatMoney(sistema)}
                            </td>
                            <td className="ds-table__num">
                              {contado != null ? formatMoney(contado) : '—'}
                            </td>
                            <td className="ds-table__num">
                              {diff != null
                                ? `${diff > 0 ? '+' : ''}${formatMoney(diff)}`
                                : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}

            {(summary.expenses?.length ?? 0) > 0 ? (
              <>
                <h3 className="admin-dash__subtitle">Movimientos</h3>
                <div className="ds-table-wrap">
                  <table className="ds-table">
                    <thead>
                      <tr>
                        <th>Hora</th>
                        <th>Descripción</th>
                        <th>Cuenta</th>
                        <th className="ds-table__num">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.expenses!.map((e) => (
                        <tr key={e.id}>
                          <td>
                            {e.createdAt
                              ? new Date(e.createdAt).toLocaleString()
                              : '—'}
                          </td>
                          <td>
                            {e.category ? `${e.category} · ` : ''}
                            {e.description}
                          </td>
                          <td>
                            {CAJA_DAY_LABELS[e.accountId] ?? e.accountId}
                          </td>
                          <td className="ds-table__num">
                            −{formatMoney(e.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}

            {cumulative.length > 0 ? (
              <>
                <h3 className="admin-dash__subtitle">Cuentas acumulativas</h3>
                <ul className="admin-dash__list">
                  {cumulative.map((a) => (
                    <li key={a.id}>
                      <span>{a.name}</span>
                      <strong>{formatMoney(a.balance)}</strong>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>

          <div className="admin-dash__band">
            <h2 className="admin-dash__title">Conteo</h2>
            <p className="page__hint">
              {summary.live
                ? 'Turno abierto: stock sistema actual. El contado aparece al cerrar.'
                : inventoryDiffs.length > 0
                  ? `${inventoryDiffs.length} producto(s) con diferencia en este turno.`
                  : 'Inventario del cierre sin diferencias.'}
            </p>
            {inventoryRows.length === 0 ? (
              <p className="ds-empty">Sin datos de conteo para este turno.</p>
            ) : (
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
                    {inventoryRows.map((row) => (
                      <tr key={row.id}>
                        <td>{row.name}</td>
                        <td className="ds-table__num">{row.expected}</td>
                        <td className="ds-table__num">
                          {row.hasCounted ? row.counted : '—'}
                        </td>
                        <td className="ds-table__num">
                          {row.diff != null
                            ? `${row.diff > 0 ? '+' : ''}${row.diff}`
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </section>
  )
}
