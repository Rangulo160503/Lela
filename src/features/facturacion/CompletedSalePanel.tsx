import { useState } from 'react'
import type { RegisteredSale } from '../../domain/types'
import { MessageModal } from '../../components/MessageModal'
import { printSale } from '../../data/api'
import { PrintableInvoice } from './PrintableInvoice'

type CompletedSalePanelProps = {
  sale: RegisteredSale
  onNewSale: () => void
}

export function CompletedSalePanel({ sale, onNewSale }: CompletedSalePanelProps) {
  const [printMsg, setPrintMsg] = useState<string | null>(null)

  async function handlePrint() {
    window.print()
    try {
      const result = await printSale(sale.id)
      if (!result.ok) {
        setPrintMsg(
          result.error ??
            'Impresión del navegador lista. La impresora térmica no está disponible o no está configurada.',
        )
      } else {
        setPrintMsg('Enviado también a la impresora de la PC principal.')
      }
    } catch {
      setPrintMsg('Se abrió la impresión del navegador. No se pudo contactar la térmica.')
    }
  }

  return (
    <MessageModal
      open
      variant="success"
      title="Venta registrada"
      body={
        printMsg ??
        'Revisa la factura abajo. Puedes imprimirla o empezar una nueva.'
      }
      confirmLabel="Nueva factura"
      onConfirm={onNewSale}
      secondaryLabel="Imprimir"
      onSecondary={() => void handlePrint()}
    >
      <div className="completed-sale__preview">
        <p className="panel__title no-print">Vista previa de factura</p>
        <PrintableInvoice sale={sale} />
      </div>
    </MessageModal>
  )
}
