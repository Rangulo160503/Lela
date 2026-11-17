import { registerSale } from './registerSale'
import type { Product, SaleError } from './types'

export type SaleLineInput = {
  productId: string
  quantity: number
}

export type RegisterSaleLinesResult =
  | { ok: true; nextProducts: Product[] }
  | {
      ok: false
      error: SaleError | 'empty_sale'
      productId?: string
    }

/**
 * Valida todas las líneas primero. Solo si todas son válidas,
 * calcula el inventario final. No aplica cambios parciales.
 */
export function registerSaleLines(
  products: Product[],
  lines: SaleLineInput[],
): RegisterSaleLinesResult {
  const activeLines = lines.filter((line) => line.quantity !== 0)

  if (activeLines.length === 0) {
    return { ok: false, error: 'empty_sale' }
  }

  const nextProducts = products.map((p) => ({ ...p }))

  for (const line of activeLines) {
    const index = nextProducts.findIndex((p) => p.id === line.productId)
    if (index < 0) {
      return { ok: false, error: 'out_of_stock', productId: line.productId }
    }

    const result = registerSale(nextProducts[index].physicalStock, line.quantity)
    if (!result.ok) {
      return { ok: false, error: result.error, productId: line.productId }
    }

    nextProducts[index] = {
      ...nextProducts[index],
      physicalStock: result.newStock,
    }
  }

  return { ok: true, nextProducts }
}
