import { useState } from 'react'
import { FacturacionModal } from '../features/facturacion/FacturacionModal'
import { SaleHistory } from '../features/facturacion/SaleHistory'
import { useInventory } from '../features/inventario/InventoryContext'

export function FacturacionPage() {
  const { sales } = useInventory()
  const [facturacionOpen, setFacturacionOpen] = useState(false)

  return (
    <main className="page page--wide page--editorial">
      <header className="module-head module-head--ops">
        <div className="module-head__copy">
          <p className="module-head__kicker ops-hide-mobile">Punto de venta</p>
          <h1 className="module-head__title">Facturación</h1>
          <p className="module-head__lede ops-hide-mobile">
            Historial del día. Abre el POS para cobrar una venta nueva.
          </p>
        </div>
        <div className="module-head__actions">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setFacturacionOpen(true)}
          >
            Nueva venta
          </button>
        </div>
      </header>

      <FacturacionModal
        open={facturacionOpen}
        onClose={() => setFacturacionOpen(false)}
      />

      <section aria-label="Facturas registradas">
        <div className="ds-toolbar">
          <h2 className="ds-toolbar__title">Registro de facturas</h2>
          <p className="ds-toolbar__meta">{sales.length} en total</p>
        </div>
        <SaleHistory sales={sales} />
      </section>
    </main>
  )
}
