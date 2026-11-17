import { MessageModal } from '../../components/MessageModal'
import type { RegisteredSale } from '../../domain/types'
import { PrintableInvoice } from './PrintableInvoice'

type SaleInvoiceModalProps = {
  sale: RegisteredSale | null
  onClose: () => void
}

export function SaleInvoiceModal({ sale, onClose }: SaleInvoiceModalProps) {
  if (!sale) return null

  return (
    <MessageModal
      open
      variant="info"
      title="Factura"
      body="Misma factura de la venta. Puedes imprimirla o cerrar."
      confirmLabel="Cerrar"
      onConfirm={onClose}
      secondaryLabel="Imprimir factura"
      onSecondary={() => window.print()}
    >
      <div className="completed-sale__preview">
        <p className="panel__title no-print">Vista previa de factura</p>
        <PrintableInvoice sale={sale} />
      </div>
    </MessageModal>
  )
}
