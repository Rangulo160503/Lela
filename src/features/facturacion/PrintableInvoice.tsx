import { formatMoney } from '../../domain/buildProforma'
import type { RegisteredSale } from '../../domain/types'
import { PAYMENT_METHOD_LABELS } from '../../domain/types'

type PrintableInvoiceProps = {
  sale: RegisteredSale
}

function formatSaleTime(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function shortSaleId(id: string): string {
  return id.replace(/^venta-/, '').slice(-8).toUpperCase()
}

export function PrintableInvoice({ sale }: PrintableInvoiceProps) {
  return (
    <article
      id="printable-invoice"
      className="print-sheet"
      aria-label="Vista previa de factura para imprimir"
    >
      <header className="print-sheet__header">
        <div>
          <p className="print-sheet__brand">Panadería Lela</p>
          <p className="print-sheet__meta">Factura de venta</p>
        </div>
        <div className="print-sheet__ids">
          <p>
            Folio <strong>{shortSaleId(sale.id)}</strong>
          </p>
          <p>{formatSaleTime(sale.createdAt)}</p>
        </div>
      </header>

      <table className="print-sheet__table">
        <caption className="visually-hidden">Líneas de la factura</caption>
        <thead>
          <tr>
            <th scope="col">Producto</th>
            <th scope="col">Cant.</th>
            <th scope="col">Precio</th>
            <th scope="col">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {sale.lines.map((line) => (
            <tr key={line.productId}>
              <td>{line.name}</td>
              <td>{line.quantity}</td>
              <td>{formatMoney(line.unitPrice)}</td>
              <td>{formatMoney(line.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="print-sheet__totals">
        <div>
          <dt>Total</dt>
          <dd>{formatMoney(sale.total)}</dd>
        </div>
        <div>
          <dt>Pago</dt>
          <dd>{PAYMENT_METHOD_LABELS[sale.paymentMethod]}</dd>
        </div>
        <div>
          <dt>Recibido</dt>
          <dd>{formatMoney(sale.amountPaid)}</dd>
        </div>
        {sale.change > 0 ? (
          <div>
            <dt>Vuelto</dt>
            <dd>{formatMoney(sale.change)}</dd>
          </div>
        ) : null}
      </dl>

      <p className="print-sheet__footer">Gracias por su compra</p>
    </article>
  )
}
