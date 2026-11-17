import type { RegisteredSale } from './types'

function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

function formatSaleTime(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

/**
 * Filtra facturas por producto, total, hora o id.
 * La lista de entrada se asume ya ordenada (más recientes primero).
 */
export function searchSales(
  sales: RegisteredSale[],
  query: string,
): RegisteredSale[] {
  const q = normalize(query)
  if (!q) return sales

  const qDigits = q.replace(/[^\d.]/g, '')

  return sales.filter((sale) => {
    const time = normalize(formatSaleTime(sale.createdAt))
    const totalText = normalize(sale.total.toFixed(2))
    const idText = normalize(sale.id)
    const productText = normalize(
      sale.lines.map((line) => `${line.name} ${line.quantity}`).join(' '),
    )

    if (time.includes(q) || idText.includes(q) || productText.includes(q)) {
      return true
    }

    if (totalText.includes(q)) return true
    if (qDigits && String(sale.total).includes(qDigits)) return true

    return false
  })
}
