import type { Product } from '../domain/types'

/** Datos de prueba — no es el catálogo definitivo de Panadería Lela */
export const MOCK_PAN_PRODUCT_ID = 'mock-pan'
export const MOCK_REPOSTERIA_PRODUCT_ID = 'mock-reposteria'

export const MOCK_PRODUCTS: Product[] = [
  {
    id: MOCK_PAN_PRODUCT_ID,
    name: 'Pan',
    physicalStock: 100,
    unitPrice: 15,
  },
  {
    id: MOCK_REPOSTERIA_PRODUCT_ID,
    name: 'Repostería',
    physicalStock: 50,
    unitPrice: 25,
  },
  {
    id: 'mock-bolillo',
    name: 'Bolillo',
    physicalStock: 80,
    unitPrice: 8,
  },
  {
    id: 'mock-concha',
    name: 'Concha',
    physicalStock: 40,
    unitPrice: 12,
  },
  {
    id: 'mock-cuernito',
    name: 'Cuernito',
    physicalStock: 35,
    unitPrice: 14,
  },
  {
    id: 'mock-oreja',
    name: 'Oreja',
    physicalStock: 30,
    unitPrice: 13,
  },
  {
    id: 'mock-galleta',
    name: 'Galleta',
    physicalStock: 60,
    unitPrice: 10,
  },
  {
    id: 'mock-pastelito',
    name: 'Pastelito',
    physicalStock: 20,
    unitPrice: 28,
  },
  {
    id: 'mock-cafe',
    name: 'Café',
    physicalStock: 45,
    unitPrice: 22,
  },
  {
    id: 'mock-empanada',
    name: 'Empanada',
    physicalStock: 25,
    unitPrice: 18,
  },
]
