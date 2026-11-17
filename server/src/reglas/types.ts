export type Product = {
  id: string
  name: string
  physicalStock: number
  unitPrice: number
  /** Ruta pública local, p. ej. /images/products/pan.jpg */
  photoPath?: string | null
}

export type SaleError =
  | 'invalid_quantity'
  | 'insufficient_stock'
  | 'out_of_stock'

export type ProformaLine = {
  productId: string
  name: string
  quantity: number
  unitPrice: number
  subtotal: number
}

export type Proforma = {
  lines: ProformaLine[]
  total: number
}

export type PaymentMethod = 'efectivo' | 'sinpe' | 'tarjeta'

export type RegisteredSale = {
  id: string
  createdAt: string
  lines: ProformaLine[]
  total: number
  paymentMethod: PaymentMethod
  amountPaid: number
  change: number
}

export type ProductionDraftLine = {
  productId: string
  name: string
  sold: number
  stock: number
  quantity: number
}

export type ProductionLine = {
  productId: string
  name: string
  sold: number
  stockBefore: number
  quantity: number
}

export type ProductionSheet = {
  id: string
  businessDate: string
  createdAt: string
  lines: ProductionLine[]
}

export type MermaRecord = {
  id: string
  createdAt: string
  productId: string
  productName: string
  quantity: number
  stockBefore: number
  stockAfter: number
  reason: string
}

export type LegacyStore = {
  products?: Product[]
  sales?: RegisteredSale[]
  productionSheets?: ProductionSheet[]
  mermaRecords?: MermaRecord[]
}
