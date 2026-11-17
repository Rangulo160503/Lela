import { useEffect, useState } from 'react'
import { MessageModal } from '../../components/MessageModal'
import { useInventory } from './InventoryContext'

type MermaModalProps = {
  open: boolean
  onClose: () => void
}

const MOTIVES = [
  'Producto dañado',
  'Producto quemado',
  'Devolución',
  'Consumo interno',
  'Pérdida',
  'Otros',
]

export function MermaModal({ open, onClose }: MermaModalProps) {
  const { products, applyMerma } = useInventory()
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [motive, setMotive] = useState(MOTIVES[0])
  const [alert, setAlert] = useState<{
    title: string
    body: string
    variant: 'success' | 'error'
  } | null>(null)

  useEffect(() => {
    if (!open) return
    setQuantities({})
    setAlert(null)
  }, [open])

  if (!open) return null

  async function registerLine(productId: string, productName: string) {
    const raw = quantities[productId]?.trim() ?? ''
    const quantity = Number(raw)
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setAlert({
        title: 'Cantidad no válida',
        body: `Indica una cantidad válida para ${productName}.`,
        variant: 'error',
      })
      return
    }

    try {
      const result = await applyMerma(productId, quantity, motive)
      if (!result.ok) {
        setAlert({
          title: 'No se pudo registrar',
          body:
            result.error === 'insufficient_stock'
              ? `No hay suficiente stock de ${productName}.`
              : `No se pudo registrar merma de ${productName}.`,
          variant: 'error',
        })
        return
      }

      setQuantities((prev) => ({ ...prev, [productId]: '' }))
      const stockAfter =
        'record' in result && result.record
          ? result.record.stockAfter
          : '—'
      setAlert({
        title: 'Salida registrada',
        body: `Se registraron ${quantity} de ${productName} (${motive}). Stock: ${stockAfter}.`,
        variant: 'success',
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
          aria-labelledby="merma-modal-title"
        >
          <header className="modal__header">
            <div className="modal__heading">
              <h2 id="merma-modal-title" className="modal__title">
                Merma
              </h2>
              <p className="modal__meta">
                Indica motivo y cantidad por producto.
              </p>
            </div>
            <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>
              Cerrar
            </button>
          </header>

          <label className="field__label" htmlFor="merma-motive">
            Motivo
          </label>
          <select
            id="merma-motive"
            className="field__input"
            value={motive}
            onChange={(e) => setMotive(e.target.value)}
            style={{ marginBottom: '1rem' }}
          >
            {MOTIVES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <div className="ds-table-wrap">
            <table className="ds-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="ds-table__num">Stock</th>
                  <th>Cantidad</th>
                  <th className="ds-table__actions">Acción</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>{product.name}</td>
                    <td className="ds-table__num">{product.physicalStock}</td>
                    <td>
                      <input
                        className="field__input"
                        style={{ maxWidth: '5.5rem', minHeight: '2.35rem', padding: '0.4rem 0.5rem' }}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={product.physicalStock}
                        step={1}
                        placeholder="0"
                        disabled={product.physicalStock <= 0}
                        value={quantities[product.id] ?? ''}
                        aria-label={`Cantidad de merma de ${product.name}`}
                        onChange={(e) =>
                          setQuantities((prev) => ({
                            ...prev,
                            [product.id]: e.target.value,
                          }))
                        }
                      />
                    </td>
                    <td className="ds-table__actions">
                      <button
                        type="button"
                        className="btn btn--danger btn--sm"
                        disabled={product.physicalStock <= 0}
                        onClick={() => registerLine(product.id, product.name)}
                      >
                        Quitar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <MessageModal
        open={Boolean(alert)}
        variant={alert?.variant ?? 'info'}
        title={alert?.title ?? ''}
        body={alert?.body}
        confirmLabel="Entendido"
        onConfirm={() => setAlert(null)}
      />
    </>
  )
}
