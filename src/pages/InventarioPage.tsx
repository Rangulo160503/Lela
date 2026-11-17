import { useState } from 'react'
import { MermaModal } from '../features/inventario/MermaModal'
import { ProductionHistory } from '../features/inventario/ProductionHistory'
import { ProductionSheetModal } from '../features/inventario/ProductionSheetModal'
import { useInventory } from '../features/inventario/InventoryContext'
import { SCENE } from '../data/productVisuals'

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('es-CR', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

export function InventarioPage() {
  const { products, productionSheets, mermaRecords } = useInventory()
  const [mermaOpen, setMermaOpen] = useState(false)
  const [productionOpen, setProductionOpen] = useState(false)

  return (
    <main className="page page--wide page--editorial">
      <header className="module-head module-head--ops module-head--compact-media">
        <div className="module-head__copy">
          <p className="module-head__kicker ops-hide-mobile">Bodega y horno</p>
          <h1 className="module-head__title">Inventario</h1>
          <p className="module-head__lede ops-hide-mobile">
            Stock físico, producción y mermas.
          </p>
        </div>
        <figure className="module-head__media ops-hide-mobile">
          <img src={SCENE.ingredients} alt="" decoding="async" />
        </figure>
      </header>

      <div className="ds-toolbar">
        <div className="ds-toolbar__start">
          <p className="ds-toolbar__meta">{products.length} productos</p>
        </div>
        <div className="ds-toolbar__end">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              setMermaOpen(false)
              setProductionOpen(true)
            }}
          >
            Producción
          </button>
          <button
            type="button"
            className="btn btn--danger"
            onClick={() => {
              setProductionOpen(false)
              setMermaOpen(true)
            }}
          >
            Merma
          </button>
        </div>
      </div>

      <ProductionSheetModal
        open={productionOpen}
        onClose={() => setProductionOpen(false)}
      />
      <MermaModal open={mermaOpen} onClose={() => setMermaOpen(false)} />

      <section aria-label="Stock físico">
        <h2 className="ds-toolbar__title" style={{ marginBottom: '0.75rem' }}>
          Stock físico
        </h2>
        {products.length === 0 ? (
          <p className="ds-empty">Sin productos.</p>
        ) : (
          <div className="ds-table-wrap">
            <table className="ds-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="ds-table__num">Disponible</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>{product.name}</td>
                    <td className="ds-table__num">{product.physicalStock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-label="Mermas registradas" style={{ marginTop: '2rem' }}>
        <h2 className="ds-toolbar__title" style={{ marginBottom: '0.75rem' }}>
          Mermas y salidas
        </h2>
        {mermaRecords.length === 0 ? (
          <p className="ds-empty">Todavía no hay registros de merma.</p>
        ) : (
          <div className="ds-table-wrap">
            <table className="ds-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="ds-table__num">Cantidad</th>
                  <th>Motivo</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {mermaRecords.slice(0, 10).map((record) => (
                  <tr key={record.id}>
                    <td>{record.productName}</td>
                    <td className="ds-table__num">−{record.quantity}</td>
                    <td>{record.reason}</td>
                    <td>{formatTime(record.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-label="Hojas de producción" style={{ marginTop: '2rem' }}>
        <h2 className="ds-toolbar__title" style={{ marginBottom: '0.75rem' }}>
          Hojas de producción
        </h2>
        <ProductionHistory sheets={productionSheets} />
      </section>
    </main>
  )
}
