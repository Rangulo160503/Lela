import type {
  LegacyStore,
  MermaRecord,
  PaymentMethod,
  Product,
  ProductionDraftLine,
  ProductionSheet,
  RegisteredSale,
} from '../reglas/types.js'

export type SaleLineInput = { productId: string; quantity: number }

export type SellLinesInput = {
  lines: SaleLineInput[]
  paymentMethod: PaymentMethod
  amountPaid: number
  /** Precio forzado (combos/promos); el inventario sí descuenta componentes. */
  totalOverride?: number
  saleLabel?: string
}

export type SellLinesResult =
  | { ok: true; sale: RegisteredSale }
  | {
      ok: false
      error:
        | 'invalid_quantity'
        | 'insufficient_stock'
        | 'out_of_stock'
        | 'empty_sale'
        | 'missing_method'
        | 'invalid_amount'
        | 'insufficient_amount'
      productId?: string
    }

export type SaveProductionResult =
  | { ok: true; sheet: ProductionSheet }
  | { ok: false; error: 'invalid_quantity' | 'already_saved_today' }

export type ApplyMermaResult =
  | { ok: true; record: MermaRecord }
  | {
      ok: false
      error: 'invalid_quantity' | 'insufficient_stock' | 'product_not_found'
    }

export type ImportLegacyResult =
  | { ok: true; imported: boolean; reason?: string }
  | { ok: false; error: string }

export type Snapshot = {
  products: Product[]
  sales: RegisteredSale[]
  productionSheets: ProductionSheet[]
  mermaRecords: MermaRecord[]
  serverTime: string
}

export type SystemInfo = {
  ok: true
  port: number
  lanAddresses: string[]
  dbPath: string
  serverTime: string
}

/** Contrato que la API usa — no conoce DA ni reglas concretas. */
export interface IAppFlujo {
  getSystemInfo(): SystemInfo
  getSnapshot(): Snapshot
  sellLines(input: SellLinesInput): SellLinesResult
  saveProductionSheet(lines: ProductionDraftLine[]): SaveProductionResult
  applyMerma(
    productId: string,
    quantity: number,
    reason: string,
  ): ApplyMermaResult
  importLegacy(store: LegacyStore): ImportLegacyResult
  buildProductionDraft(): ProductionDraftLine[]
}
