import { useEffect, useState } from 'react'
import { apiPost } from '../../data/api'
import { formatMoney } from '../../domain/buildProforma'

export type DashData = {
  salesCount: number
  salesTotal: number
  byMethod: Record<string, number>
  openProposals: number
  purchasesOpen: number
  mermaCount: number
  exitsCount: number
  productionCount?: number
  expensesCount?: number
  accounts: { id: string; name: string; balance: number }[]
}

const CAJA_DAY_IDS = ['acc-efectivo', 'acc-tarjeta', 'acc-sinpe'] as const
const CAJA_DAY_LABELS: Record<string, string> = {
  'acc-efectivo': 'Efectivo',
  'acc-tarjeta': 'Tarjetas',
  'acc-sinpe': 'SINPE',
}

type ProductRow = { id: string; name: string; physicalStock: number }

type OpenShift = { id: string; businessDate: string }

const CUMULATIVE_IDS = ['acc-banco', 'acc-fuerte'] as const

const CUMULATIVE_LABELS: Record<string, string> = {
  'acc-banco': 'Cuenta bancaria',
  'acc-fuerte': 'Caja fuerte',
}

type DashboardPanelProps = {
  dash: DashData
  openShift: OpenShift | null
  products: ProductRow[]
  onClosed: () => void
  onMessage?: (msg: string) => void
}

export function DashboardPanel({
  dash,
  openShift,
  products,
  onClosed,
  onMessage,
}: DashboardPanelProps) {
  const efectivo =
    dash.accounts.find((a) => a.id === 'acc-efectivo')?.balance ?? 0

  const [countedCash, setCountedCash] = useState(efectivo)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    setCountedCash(efectivo)
  }, [efectivo, openShift?.id])

  useEffect(() => {
    setCounts(
      Object.fromEntries(products.map((p) => [p.id, p.physicalStock])),
    )
  }, [products, openShift?.id])

  const cumulative = CUMULATIVE_IDS.map((id) => {
    const found = dash.accounts.find((a) => a.id === id)
    return {
      id,
      name: CUMULATIVE_LABELS[id] ?? found?.name ?? id,
      balance: found?.balance ?? 0,
    }
  })

  const mermasYSalidas = dash.mermaCount + dash.exitsCount
  const produccion = dash.productionCount ?? 0
  const movimientos = dash.expensesCount ?? 0

  const cajaDia = CAJA_DAY_IDS.map((id) => {
    const found = dash.accounts.find((a) => a.id === id)
    return {
      id,
      name: CAJA_DAY_LABELS[id] ?? found?.name ?? id,
      balance: found?.balance ?? 0,
    }
  })

  async function closeShift() {
    if (!openShift) return
    setClosing(true)
    try {
      const r = await apiPost<{ ok: boolean; differences?: number }>(
        `/shifts/${openShift.id}/close`,
        {
          countedCash,
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
      onClosed()
    } catch (err) {
      onMessage?.(err instanceof Error ? err.message : 'Error al cerrar')
    } finally {
      setClosing(false)
    }
  }

  return (
    <section className="admin-dash">
      <div className="admin-dash__band">
        <h2 className="admin-dash__title">Cuentas acumulativas</h2>
        <ul className="admin-dash__list">
          {cumulative.map((a) => (
            <li key={a.id}>
              <span>{a.name}</span>
              <strong>{formatMoney(a.balance)}</strong>
            </li>
          ))}
        </ul>
      </div>

      <div className="admin-dash__band">
        <h2 className="admin-dash__title">Actividad</h2>
        <p className="admin-dash__stat">
          {dash.salesCount} ventas · {formatMoney(dash.salesTotal)}
        </p>
        <ul className="admin-dash__list">
          {Object.entries(dash.byMethod).map(([k, v]) => (
            <li key={k}>
              <span>{k}</span>
              <strong>{formatMoney(v)}</strong>
            </li>
          ))}
          <li>
            <span>Producción / entradas</span>
            <strong>{produccion}</strong>
          </li>
          <li>
            <span>Mermas / salidas</span>
            <strong>{mermasYSalidas}</strong>
          </li>
          <li>
            <span>Movimientos de caja</span>
            <strong>{movimientos}</strong>
          </li>
        </ul>

        <h3 className="admin-dash__subtitle">Caja del día</h3>
        <ul className="admin-dash__list">
          {cajaDia.map((a) => (
            <li key={a.id}>
              <span>{a.name}</span>
              <strong>{formatMoney(a.balance)}</strong>
            </li>
          ))}
        </ul>

        <button
          type="button"
          className="btn btn--secondary"
          onClick={async () => {
            const { default: ExcelJS } = await import('exceljs')
            const wb = new ExcelJS.Workbook()
            const ws = wb.addWorksheet('Dashboard')
            ws.addRow(['Ventas', dash.salesCount, dash.salesTotal])
            Object.entries(dash.byMethod).forEach(([k, v]) => ws.addRow([k, v]))
            ws.addRow(['Producción / entradas', produccion])
            ws.addRow(['Mermas / salidas', mermasYSalidas])
            ws.addRow(['Movimientos de caja', movimientos])
            cajaDia.forEach((a) => ws.addRow([`Caja · ${a.name}`, a.balance]))
            cumulative.forEach((a) => ws.addRow([a.name, a.balance]))
            const buf = await wb.xlsx.writeBuffer()
            const blob = new Blob([buf], {
              type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'dashboard-lela.xlsx'
            a.click()
            URL.revokeObjectURL(url)
          }}
        >
          Exportar Excel
        </button>
      </div>

      <div className="admin-dash__band admin-dash__band--cierre">
        <h2 className="admin-dash__title">Cierre de turno</h2>
        {!openShift ? (
          <p className="page__hint">
            Sin turno abierto. Ábrelo en Resumen → Turnos.
          </p>
        ) : (
          <>
            <p className="page__hint">
              Turno {openShift.businessDate}. Esperado en efectivo:{' '}
              {formatMoney(efectivo)}
            </p>
            <label className="field__label" htmlFor="dash-counted-cash">
              Efectivo contado
            </label>
            <input
              id="dash-counted-cash"
              className="field__input"
              type="number"
              value={countedCash}
              onChange={(e) => setCountedCash(Number(e.target.value))}
            />

            <h3 className="admin-dash__subtitle">Conteo de productos</h3>
            <div className="ds-table-wrap">
              <table className="ds-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th className="ds-table__num">Sistema</th>
                    <th className="ds-table__num">Contado</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
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
                          value={counts[p.id] ?? 0}
                          onChange={(e) =>
                            setCounts({
                              ...counts,
                              [p.id]: Number(e.target.value),
                            })
                          }
                          aria-label={`Conteo de ${p.name}`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              className="btn btn--primary"
              style={{ marginTop: '1rem' }}
              disabled={closing}
              onClick={() => void closeShift()}
            >
              {closing ? 'Cerrando…' : 'Cierre'}
            </button>
          </>
        )}
      </div>
    </section>
  )
}
