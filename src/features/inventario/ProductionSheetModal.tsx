import { useEffect, useState } from 'react'
import { MessageModal } from '../../components/MessageModal'
import { buildProductionDraft } from '../../domain/buildProductionDraft'
import { formatDayLabel, localDateKey } from '../../domain/dates'
import type { ProductionDraftLine } from '../../domain/types'
import { useInventory } from './InventoryContext'

type ProductionSheetModalProps = {
  open: boolean
  onClose: () => void
}

export function ProductionSheetModal({ open, onClose }: ProductionSheetModalProps) {
  const {
    products,
    sales,
    lastProductionCreatedAt,
    saveProductionSheet,
  } = useInventory()
  const [lines, setLines] = useState<ProductionDraftLine[]>([])
  const [alert, setAlert] = useState<{
    title: string
    body: string
    variant: 'success' | 'error'
    closeAfter?: boolean
  } | null>(null)

  useEffect(() => {
    if (!open) return
    setAlert(null)
    setLines(buildProductionDraft(products, sales, lastProductionCreatedAt))
  }, [open, products, sales, lastProductionCreatedAt])

  if (!open) return null

  function setQuantity(productId: string, raw: string) {
    setLines((prev) =>
      prev.map((line) => {
        if (line.productId !== productId) return line
        if (raw === '') return { ...line, quantity: 0 }
        const quantity = Number(raw)
        if (!Number.isInteger(quantity) || quantity < 0) return line
        return { ...line, quantity }
      }),
    )
  }

  async function handleSave() {
    try {
      const result = await saveProductionSheet(lines)
      if (!result.ok) {
        setAlert({
          title: 'No se pudo guardar',
          body:
            result.error === 'already_saved_today'
              ? 'Ya existe una hoja de producción para hoy.'
              : 'Las cantidades deben ser enteros mayores o iguales a 0.',
          variant: 'error',
        })
        return
      }

      setAlert({
        title: 'Hoja guardada',
        body: 'La producción quedó registrada y el inventario físico se actualizó.',
        variant: 'success',
        closeAfter: true,
      })
    } catch {
      setAlert({
        title: 'Servidor no disponible',
        body: 'No se pudo contactar al servidor de la computadora principal.',
        variant: 'error',
      })
    }
  }

  return (
    <>
      <div className="modal-backdrop" role="presentation">
        <div
          className="modal modal--opaque modal--wide"
          role="dialog"
          aria-modal="true"
          aria-labelledby="production-sheet-title"
        >
          <header className="modal__header">
            <div className="modal__heading">
              <h2 id="production-sheet-title" className="modal__title">
                Hoja de producción
              </h2>
              <p className="modal__meta">{formatDayLabel(localDateKey())}</p>
            </div>
            <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>
              Cerrar
            </button>
          </header>
          <p className="message-modal__lead">
            Sugerido = vendido − inventario. Edita las cantidades antes de guardar.
          </p>

          <div className="ds-table-wrap">
            <table className="ds-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="ds-table__num">Vendido</th>
                  <th className="ds-table__num">Stock</th>
                  <th className="ds-table__num">A producir</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.productId}>
                    <td>{line.name}</td>
                    <td className="ds-table__num">{line.sold}</td>
                    <td className="ds-table__num">{line.stock}</td>
                    <td className="ds-table__num">
                      <input
                        className="field__input"
                        style={{ maxWidth: '5.5rem', minHeight: '2.35rem', padding: '0.4rem 0.5rem' }}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1}
                        value={line.quantity}
                        onChange={(e) => setQuantity(line.productId, e.target.value)}
                        aria-label={`Cantidad a producir de ${line.name}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="button" className="btn btn--primary" onClick={handleSave}>
              Guardar hoja
            </button>
          </div>
        </div>
      </div>

      <MessageModal
        open={Boolean(alert)}
        variant={alert?.variant ?? 'info'}
        title={alert?.title ?? ''}
        body={alert?.body}
        confirmLabel="Entendido"
        onConfirm={() => {
          const shouldClose = alert?.closeAfter
          setAlert(null)
          if (shouldClose) onClose()
        }}
      />
    </>
  )
}
