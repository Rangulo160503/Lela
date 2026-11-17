import type { ProductsRepo } from '../da/repositories/productsRepo.js'
import type { Product } from '../reglas/types.js'

/** Fotos genéricas locales — una distinta por producto semilla. */
export const SEED_PRODUCT_PHOTOS: Record<string, string> = {
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

/** Mismos datos mock Stage 1 — semilla solo si la BD está vacía. */
export const SEED_PRODUCTS: Product[] = [
  { id: 'mock-pan', name: 'Pan', physicalStock: 100, unitPrice: 15, photoPath: SEED_PRODUCT_PHOTOS['mock-pan'] },
  { id: 'mock-reposteria', name: 'Repostería', physicalStock: 50, unitPrice: 25, photoPath: SEED_PRODUCT_PHOTOS['mock-reposteria'] },
  { id: 'mock-bolillo', name: 'Bolillo', physicalStock: 80, unitPrice: 8, photoPath: SEED_PRODUCT_PHOTOS['mock-bolillo'] },
  { id: 'mock-concha', name: 'Concha', physicalStock: 40, unitPrice: 12, photoPath: SEED_PRODUCT_PHOTOS['mock-concha'] },
  { id: 'mock-cuernito', name: 'Cuernito', physicalStock: 35, unitPrice: 14, photoPath: SEED_PRODUCT_PHOTOS['mock-cuernito'] },
  { id: 'mock-oreja', name: 'Oreja', physicalStock: 30, unitPrice: 13, photoPath: SEED_PRODUCT_PHOTOS['mock-oreja'] },
  { id: 'mock-galleta', name: 'Galleta', physicalStock: 60, unitPrice: 10, photoPath: SEED_PRODUCT_PHOTOS['mock-galleta'] },
  { id: 'mock-pastelito', name: 'Pastelito', physicalStock: 20, unitPrice: 28, photoPath: SEED_PRODUCT_PHOTOS['mock-pastelito'] },
  { id: 'mock-cafe', name: 'Café', physicalStock: 45, unitPrice: 22, photoPath: SEED_PRODUCT_PHOTOS['mock-cafe'] },
  { id: 'mock-empanada', name: 'Empanada', physicalStock: 25, unitPrice: 18, photoPath: SEED_PRODUCT_PHOTOS['mock-empanada'] },
]

export function seedIfEmpty(productsRepo: ProductsRepo): void {
  if (productsRepo.count() === 0) {
    productsRepo.upsertMany(SEED_PRODUCTS)
  }
  productsRepo.ensurePhotos(SEED_PRODUCT_PHOTOS)
}
