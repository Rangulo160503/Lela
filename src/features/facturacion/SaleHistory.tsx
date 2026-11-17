import { useEffect, useMemo, useState } from 'react'
import { formatMoney } from '../../domain/buildProforma'
import { searchSales } from '../../domain/searchSales'
import type { RegisteredSale } from '../../domain/types'
import { PAYMENT_METHOD_LABELS } from '../../domain/types'
import { SaleInvoiceModal } from './SaleInvoiceModal'

const PAGE_SIZE = 8

function formatSaleTime(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

type SaleHistoryProps = {
  sales: RegisteredSale[]
}

export function SaleHistory({ sales }: SaleHistoryProps) {
  const [query, setQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [selectedSale, setSelectedSale] = useState<RegisteredSale | null>(null)

  const filtered = useMemo(() => searchSales(sales, query), [sales, query])

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [query, sales.length])

  const visible = filtered.slice(0, visibleCount)
  const remaining = filtered.length - visible.length

  if (sales.length === 0) {
    return (
      <p className="ds-empty">
        Todavía no hay facturas. Usa Nueva venta para cobrar.
      </p>
    )
  }

  return (
    <div className="sale-history-panel">
      <div className="field">
        <label className="visually-hidden" htmlFor="sales-search">
          Buscar factura
        </label>
        <input
          id="sales-search"
          className="field__input"
          type="search"
          placeholder="Buscar por producto, total u hora…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />
      </div>

      <p className="ds-toolbar__meta">
        {filtered.length === 0
          ? 'Sin coincidencias.'
          : `Mostrando ${visible.length} de ${filtered.length}`}
      </p>

      {visible.length > 0 ? (
        <ul className="register-list">
          {visible.map((sale) => {
            const summary = sale.lines
              .map((l) => `${l.quantity}× ${l.name}`)
              .join(', ')
            return (
              <li key={sale.id} className="register-row">
                <div className="register-row__main">
                  <p className="register-row__title">{formatSaleTime(sale.createdAt)}</p>
                  <p className="register-row__meta">
                    {PAYMENT_METHOD_LABELS[sale.paymentMethod ?? 'efectivo']} ·{' '}
                    {summary}
                  </p>
                </div>
                <span className="register-row__amount">
                  {formatMoney(sale.total)}
                </span>
                <div className="register-row__action">
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => setSelectedSale(sale)}
                  >
                    Ver
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
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

      <SaleInvoiceModal
        sale={selectedSale}
        onClose={() => setSelectedSale(null)}
      />
    </div>
  )
}
