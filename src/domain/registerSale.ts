import type { SaleError } from './types'

export type RegisterSaleResult =
  | { ok: true; newStock: number }
  | { ok: false; error: SaleError }

/**
 * Inventario final = Inventario inicial - Cantidad vendida
 * No muta estado: solo calcula el resultado si la venta es válida.
 */
export function registerSale(
  currentStock: number,
  quantity: number,
): RegisterSaleResult {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { ok: false, error: 'invalid_quantity' }
  }

  if (currentStock <= 0) {
    return { ok: false, error: 'out_of_stock' }
  }

  if (quantity > currentStock) {
    return { ok: false, error: 'insufficient_stock' }
  }

  return { ok: true, newStock: currentStock - quantity }
}
