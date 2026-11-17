import { useState } from 'react'
import { formatMoney } from '../../domain/buildProforma'
import type { Proforma } from '../../domain/types'

type InvoicePreviewProps = {
  proforma: Proforma
  onDecrease: (productId: string) => void
  onIncrease: (productId: string) => void
  onRemove: (productId: string) => void
  onSetQuantity: (productId: string, quantity: number) => void
  maxQuantityFor: (productId: string) => number
}

export function InvoicePreview({
  proforma,
  onDecrease,
  onIncrease,
  onRemove,
  onSetQuantity,
  maxQuantityFor,
}: InvoicePreviewProps) {
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  function clearDraft(productId: string) {
    setDrafts((prev) => {
      if (!(productId in prev)) return prev
      const next = { ...prev }
      delete next[productId]
      return next
    })
  }

  return (
    <aside
      className="invoice-preview"
      aria-live="polite"
      aria-labelledby="invoice-detail-title"
    >
      <h3 id="invoice-detail-title" className="panel__title">
        Carrito
      </h3>
      <p className="invoice-preview__brand">Panadería Lela</p>

      {proforma.lines.length === 0 ? (
        <p className="ds-empty">Toca un producto del catálogo para agregarlo.</p>
      ) : (
        <ul className="invoice-preview__lines">
          {proforma.lines.map((line) => {
            const max = maxQuantityFor(line.productId)
            const atMax = line.quantity >= max
            const inputValue =
              drafts[line.productId] !== undefined
                ? drafts[line.productId]
                : String(line.quantity)

            return (
              <li key={line.productId} className="invoice-preview__line">
                <div className="invoice-preview__line-main">
                  <span className="invoice-preview__name">{line.name}</span>
                  <span className="invoice-preview__qty">
                    {line.quantity} × {formatMoney(line.unitPrice)} ={' '}
                    {formatMoney(line.subtotal)}
                  </span>

                  <div className="invoice-preview__actions">
                    <button
                      type="button"
                      className="invoice-preview__step"
                      aria-label={`Quitar 1 ${line.name}`}
                      onClick={() => {
                        clearDraft(line.productId)
                        onDecrease(line.productId)
                      }}
                    >
                      −
                    </button>
                    <input
                      className="invoice-preview__qty-input"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={max}
                      step={1}
                      value={inputValue}
                      aria-label={`Cantidad de ${line.name}`}
                      onChange={(e) => {
                        const raw = e.target.value
                        setDrafts((prev) => ({
                          ...prev,
                          [line.productId]: raw,
                        }))

                        if (raw === '') return
                        const next = Number(raw)
                        if (!Number.isInteger(next) || next <= 0) return
                        onSetQuantity(line.productId, next)
                      }}
                      onBlur={() => {
                        const raw = drafts[line.productId]
                        if (raw === undefined) return

                        if (raw === '' || !Number.isInteger(Number(raw)) || Number(raw) <= 0) {
                          onRemove(line.productId)
                        } else {
                          onSetQuantity(line.productId, Number(raw))
                        }
                        clearDraft(line.productId)
                      }}
                    />
                    <button
                      type="button"
                      className="invoice-preview__step"
                      aria-label={`Agregar 1 ${line.name}`}
                      disabled={atMax}
                      onClick={() => {
                        clearDraft(line.productId)
                        onIncrease(line.productId)
                      }}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className="invoice-preview__remove"
                      aria-label={`Quitar ${line.name} de la factura`}
                      onClick={() => {
                        clearDraft(line.productId)
                        onRemove(line.productId)
                      }}
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <div className="invoice-preview__total">
        <span>Total</span>
        <strong>{formatMoney(proforma.total)}</strong>
      </div>
    </aside>
  )
}
