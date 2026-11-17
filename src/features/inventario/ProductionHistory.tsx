import { useEffect, useMemo, useState } from 'react'
import { formatDayLabel } from '../../domain/dates'
import type { ProductionSheet } from '../../domain/types'

const PAGE_SIZE = 5

type ProductionHistoryProps = {
  sheets: ProductionSheet[]
}

export function ProductionHistory({ sheets }: ProductionHistoryProps) {
  const [query, setQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sheets
    return sheets.filter((sheet) => {
      const day = formatDayLabel(sheet.businessDate).toLowerCase()
      const products = sheet.lines
        .map((line) => `${line.name} ${line.quantity}`)
        .join(' ')
        .toLowerCase()
      return day.includes(q) || products.includes(q) || sheet.businessDate.includes(q)
    })
  }, [sheets, query])

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [query, sheets.length])

  const visible = filtered.slice(0, visibleCount)
  const remaining = filtered.length - visible.length

  if (sheets.length === 0) {
    return (
      <p className="ds-empty">
        Todavía no hay hojas de producción. Usa el botón Producción.
      </p>
    )
  }

  return (
    <div className="sale-history-panel">
      <label className="field__label" htmlFor="production-search">
        Buscar hoja
      </label>
      <input
        id="production-search"
        className="field__input"
        type="search"
        placeholder="Día o producto…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
      />

      <p className="ds-toolbar__meta">
        {filtered.length === 0
          ? 'Sin coincidencias.'
          : `Mostrando ${visible.length} de ${filtered.length}`}
      </p>

      {visible.length > 0 ? (
        <div className="ds-table-wrap">
          <table className="ds-table">
            <thead>
              <tr>
                <th>Día</th>
                <th>Detalle</th>
                <th className="ds-table__num">Ítems</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((sheet) => (
                <tr key={sheet.id}>
                  <td>{formatDayLabel(sheet.businessDate)}</td>
                  <td>
                    {sheet.lines
                      .map((l) => `${l.name} (${l.quantity})`)
                      .join(' · ')}
                  </td>
                  <td className="ds-table__num">{sheet.lines.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {remaining > 0 ? (
        <button
          type="button"
          className="btn btn--secondary btn--block"
          onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
        >
          Ver más ({remaining} restantes)
        </button>
      ) : null}
    </div>
  )
}
