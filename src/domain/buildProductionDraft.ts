import type { Product, ProductionDraftLine, RegisteredSale } from './types'

/**
 * Ábaco del día:
 * sugerido = max(0, vendido - inventario_actual)
 *
 * - vendido: unidades vendidas desde la última hoja (o todo el historial si es la primera)
 * - inventario_actual: stock físico actual
 */
export function buildProductionDraft(
  products: Product[],
  sales: RegisteredSale[],
  soldSinceIso: string | null,
): ProductionDraftLine[] {
  const soldByProduct = new Map<string, number>()

  for (const sale of sales) {
    if (soldSinceIso && sale.createdAt <= soldSinceIso) continue
    for (const line of sale.lines) {
      soldByProduct.set(
        line.productId,
        (soldByProduct.get(line.productId) ?? 0) + line.quantity,
      )
    }
  }

  return products.map((product) => {
    const sold = soldByProduct.get(product.id) ?? 0
    const stock = product.physicalStock
    const suggested = Math.max(0, sold - stock)

    return {
      productId: product.id,
      name: product.name,
      sold,
      stock,
      quantity: suggested,
    }
  })
}
