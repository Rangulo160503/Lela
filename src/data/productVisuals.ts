/**
 * Fotos genéricas locales por producto (no representan SKUs exactos de Lela).
 * Cada ítem del catálogo semilla tiene su propio archivo.
 */
const SCENE = {
  bread: '/images/bread-loaf.jpg',
  croissant: '/images/croissant.jpg',
  pastry: '/images/pastry.jpg',
  coffee: '/images/coffee.jpg',
  oven: '/images/oven-bread.jpg',
  hero: '/images/hero-bakery.jpg',
  ingredients: '/images/ingredients.jpg',
} as const

/** Biblioteca seleccionable en Admin + POS */
export const PRODUCT_PHOTO_LIBRARY: { id: string; label: string; path: string }[] =
  [
    { id: 'pan', label: 'Pan', path: '/images/products/pan.jpg' },
    { id: 'bolillo', label: 'Bolillo', path: '/images/products/bolillo.jpg' },
    { id: 'cuernito', label: 'Cuernito', path: '/images/products/cuernito.jpg' },
    { id: 'concha', label: 'Concha', path: '/images/products/concha.jpg' },
    { id: 'oreja', label: 'Oreja / hojaldre', path: '/images/products/oreja.jpg' },
    { id: 'galleta', label: 'Galleta', path: '/images/products/galleta.jpg' },
    { id: 'pastelito', label: 'Pastelito', path: '/images/products/pastelito.jpg' },
    { id: 'reposteria', label: 'Repostería', path: '/images/products/reposteria.jpg' },
    { id: 'cafe', label: 'Café', path: '/images/products/cafe.jpg' },
    { id: 'empanada', label: 'Empanada', path: '/images/products/empanada.jpg' },
  ]

const BY_SEED_ID: Record<string, string> = {
  'mock-pan': '/images/products/pan.jpg',
  'mock-bolillo': '/images/products/bolillo.jpg',
  'mock-cuernito': '/images/products/cuernito.jpg',
  'mock-concha': '/images/products/concha.jpg',
  'mock-oreja': '/images/products/oreja.jpg',
  'mock-galleta': '/images/products/galleta.jpg',
  'mock-pastelito': '/images/products/pastelito.jpg',
  'mock-reposteria': '/images/products/reposteria.jpg',
  'mock-cafe': '/images/products/cafe.jpg',
  'mock-empanada': '/images/products/empanada.jpg',
}

export function productImage(product: {
  id?: string
  name: string
  photoPath?: string | null
}): string {
  if (product.photoPath) return product.photoPath
  if (product.id && BY_SEED_ID[product.id]) return BY_SEED_ID[product.id]

  const n = product.name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')

  const hit = PRODUCT_PHOTO_LIBRARY.find((item) => n.includes(item.id))
  if (hit) return hit.path

  if (n.includes('cafe')) return '/images/products/cafe.jpg'
  if (n.includes('croissant')) return '/images/products/cuernito.jpg'
  return SCENE.bread
}

/** @deprecated use productImage — kept for SCENE compositions */
export function productAtmosphereImage(name: string): string {
  return productImage({ name })
}

export { SCENE }
