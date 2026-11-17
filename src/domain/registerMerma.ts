import type { Product } from './types'

export type MermaError = 'invalid_quantity' | 'insufficient_stock' | 'product_not_found'

export type RegisterMermaResult =
  | { ok: true; nextProducts: Product[]; stockBefore: number }
  | { ok: false; error: MermaError }

/**
 * Merma: baja inventario físico sin ser una venta.
 * Inventario final = inventario actual - cantidad merma
 */
export function registerMerma(
  products: Product[],
  productId: string,
  quantity: number,
): RegisterMermaResult {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { ok: false, error: 'invalid_quantity' }
  }

  const index = products.findIndex((p) => p.id === productId)
  if (index < 0) {
    return { ok: false, error: 'product_not_found' }
  }

  const product = products[index]
  if (quantity > product.physicalStock) {
    return { ok: false, error: 'insufficient_stock' }
  }

  const nextProducts = products.map((p, i) =>
    i === index
      ? { ...p, physicalStock: p.physicalStock - quantity }
      : p,
  )

  return {
    ok: true,
    nextProducts,
    stockBefore: product.physicalStock,
  }
}
