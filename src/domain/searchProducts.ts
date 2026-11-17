import type { Product } from './types'

function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

/** Búsqueda parcial por nombre (tolera mayúsculas y acentos). */
export function searchProducts(
  products: Product[],
  query: string,
): Product[] {
  const q = normalize(query)
  if (!q) return products

  return products.filter((product) => normalize(product.name).includes(q))
}
