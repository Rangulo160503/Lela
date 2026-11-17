import type { Product, ProductionDraftLine, RegisteredSale } from './types.js'

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
    return {
      productId: product.id,
      name: product.name,
      sold,
      stock,
      quantity: Math.max(0, sold - stock),
    }
  })
}

export function localDateKey(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
