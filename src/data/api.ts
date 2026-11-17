import type {
  MermaRecord,
  PaymentMethod,
  Product,
  ProductionDraftLine,
  ProductionSheet,
  RegisteredSale,
  SaleError,
} from '../domain/types'

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api'
const TOKEN_KEY = 'panaderia-lela-token'

function token(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export type Snapshot = {
  products: Product[]
  sales: RegisteredSale[]
  productionSheets: ProductionSheet[]
  mermaRecords: MermaRecord[]
  serverTime: string
  accounts?: unknown[]
  openShift?: unknown
  promos?: unknown[]
}

export type SellLinesResult =
  | { ok: true; sale: RegisteredSale }
  | {
      ok: false
      error: SaleError | 'empty_sale' | PaymentApiError
      productId?: string
    }

type PaymentApiError =
  | 'missing_method'
  | 'invalid_amount'
  | 'insufficient_amount'

export type SaveProductionResult =
  | { ok: true; sheet: ProductionSheet }
  | { ok: false; error: 'invalid_quantity' | 'already_saved_today' }

export type ApplyMermaResult =
  | { ok: true; record: MermaRecord }
  | {
      ok: false
      error: 'invalid_quantity' | 'insufficient_stock' | 'product_not_found'
    }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  }
  const t = token()
  if (t) headers.Authorization = `Bearer ${t}`

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  })
  if (!response.ok && response.status >= 500) {
    throw new Error('Servidor no disponible')
  }
  if (response.status === 401) {
    throw new Error('Sesión expirada')
  }
  return (await response.json()) as T
}

export async function fetchHealth(): Promise<{ ok: true; lanAddresses: string[] }> {
  return request('/health')
}

export async function fetchSnapshot(): Promise<Snapshot> {
  return request('/snapshot')
}

export async function postSale(input: {
  lines?: { productId: string; quantity: number }[]
  paymentMethod: PaymentMethod
  amountPaid: number
  promoId?: string
  substitutions?: Record<string, string>
}): Promise<SellLinesResult> {
  return request('/sales', { method: 'POST', body: JSON.stringify(input) })
}

export async function printSale(saleId: string) {
  return request<{ ok: boolean; error?: string }>(`/sales/${saleId}/print`, {
    method: 'POST',
  })
}

export async function fetchProductionDraft(): Promise<{
  ok: true
  lines: ProductionDraftLine[]
}> {
  return request('/production/draft')
}

export async function postProduction(
  lines: ProductionDraftLine[],
): Promise<SaveProductionResult> {
  return request('/production', {
    method: 'POST',
    body: JSON.stringify({ lines }),
  })
}

export async function postMerma(input: {
  productId: string
  quantity: number
  reason?: string
  motive?: string
  description?: string
}): Promise<ApplyMermaResult | { ok: true; id: string }> {
  return request('/merma', { method: 'POST', body: JSON.stringify(input) })
}

export async function importLegacyStore(store: unknown): Promise<{
  ok: boolean
  imported?: boolean
  reason?: string
}> {
  return request('/system/import-legacy', {
    method: 'POST',
    body: JSON.stringify(store),
  })
}

export async function apiGet<T>(path: string): Promise<T> {
  return request(path)
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request(path, { method: 'POST', body: JSON.stringify(body ?? {}) })
}

export function subscribeStoreEvents(onChange: () => void): () => void {
  const t = token()
  if (!t) return () => {}
  const source = new EventSource(
    `${API_BASE}/events?token=${encodeURIComponent(t)}`,
  )
  source.addEventListener('store-changed', () => onChange())
  return () => source.close()
}

export { API_BASE }
