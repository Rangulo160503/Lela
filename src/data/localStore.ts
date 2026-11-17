import { MOCK_PRODUCTS } from './mockProducts'
import type {
  MermaRecord,
  Product,
  ProductionSheet,
  RegisteredSale,
} from '../domain/types'

const STORAGE_KEY = 'panaderia-lela-store-v4'

type PersistedStore = {
  products: Product[]
  sales: RegisteredSale[]
  productionSheets: ProductionSheet[]
  mermaRecords: MermaRecord[]
}

function isProduct(value: unknown): value is Product {
  if (!value || typeof value !== 'object') return false
  const p = value as Product
  return (
    typeof p.id === 'string' &&
    typeof p.name === 'string' &&
    typeof p.physicalStock === 'number' &&
    typeof p.unitPrice === 'number'
  )
}

function isSale(value: unknown): value is RegisteredSale {
  if (!value || typeof value !== 'object') return false
  const s = value as RegisteredSale
  const methodOk =
    s.paymentMethod === 'efectivo' ||
    s.paymentMethod === 'sinpe' ||
    s.paymentMethod === 'tarjeta' ||
    s.paymentMethod === undefined
  return (
    typeof s.id === 'string' &&
    typeof s.createdAt === 'string' &&
    typeof s.total === 'number' &&
    Array.isArray(s.lines) &&
    methodOk
  )
}

function isProductionSheet(value: unknown): value is ProductionSheet {
  if (!value || typeof value !== 'object') return false
  const sheet = value as ProductionSheet
  return (
    typeof sheet.id === 'string' &&
    typeof sheet.businessDate === 'string' &&
    typeof sheet.createdAt === 'string' &&
    Array.isArray(sheet.lines)
  )
}

function isMermaRecord(value: unknown): value is MermaRecord {
  if (!value || typeof value !== 'object') return false
  const m = value as MermaRecord
  return (
    typeof m.id === 'string' &&
    typeof m.createdAt === 'string' &&
    typeof m.productId === 'string' &&
    typeof m.productName === 'string' &&
    typeof m.quantity === 'number' &&
    typeof m.reason === 'string'
  )
}

function emptyStore(): PersistedStore {
  return {
    products: MOCK_PRODUCTS.map((p) => ({ ...p })),
    sales: [],
    productionSheets: [],
    mermaRecords: [],
  }
}

function readLegacy(): Partial<PersistedStore> | null {
  for (const key of [
    'panaderia-lela-store-v3',
    'panaderia-lela-store-v2',
    'panaderia-lela-store-v1',
  ]) {
    try {
      const raw = localStorage.getItem(key)
      if (raw) return JSON.parse(raw) as Partial<PersistedStore>
    } catch {
      // continue
    }
  }
  return null
}

export function loadStore(): PersistedStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw
      ? (JSON.parse(raw) as Partial<PersistedStore>)
      : readLegacy()

    if (!parsed) return emptyStore()

    const products = Array.isArray(parsed.products)
      ? parsed.products.filter(isProduct)
      : []
    const sales = Array.isArray(parsed.sales)
      ? parsed.sales.filter(isSale).map((sale) => ({
          ...sale,
          paymentMethod: sale.paymentMethod ?? ('efectivo' as const),
          amountPaid: sale.amountPaid ?? sale.total,
          change: sale.change ?? 0,
        }))
      : []
    const productionSheets = Array.isArray(parsed.productionSheets)
      ? parsed.productionSheets.filter(isProductionSheet)
      : []
    const mermaRecords = Array.isArray(parsed.mermaRecords)
      ? parsed.mermaRecords.filter(isMermaRecord)
      : []

    return {
      // Keep persisted catalog when present; otherwise seed full mock catalog.
      products:
        products.length > 0 ? products : MOCK_PRODUCTS.map((p) => ({ ...p })),
      sales,
      productionSheets,
      mermaRecords,
    }
  } catch {
    return emptyStore()
  }
}

export function saveStore(store: PersistedStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // Espacio lleno o modo privado: la app sigue en memoria.
  }
}
