import type { Product, Proforma } from './types'

/**
 * Arma la previsualización de factura a partir de cantidades del carrito.
 * Solo productos con cantidad > 0 aparecen en la proforma.
 */
export function buildProforma(
  products: Product[],
  quantities: Record<string, number>,
): Proforma {
  const lines = []

  for (const product of products) {
    const quantity = quantities[product.id] ?? 0
    if (!Number.isInteger(quantity) || quantity <= 0) continue

    lines.push({
      productId: product.id,
      name: product.name,
      quantity,
      unitPrice: product.unitPrice,
      subtotal: quantity * product.unitPrice,
    })
  }

  const total = lines.reduce((sum, line) => sum + line.subtotal, 0)
  return { lines, total }
}

export function formatMoney(amount: number): string {
  return `₡${amount.toLocaleString('es-CR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}
