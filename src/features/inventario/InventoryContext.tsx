import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  fetchSnapshot,
  importLegacyStore,
  postMerma,
  postProduction,
  postSale,
  subscribeStoreEvents,
  type ApplyMermaResult,
  type SaveProductionResult,
  type SellLinesResult,
} from '../../data/api'
import {
  markLegacyMigrated,
  readLegacyStore,
  wasLegacyMigrated,
} from '../../data/legacyBridge'
import { localDateKey } from '../../domain/dates'
import type {
  MermaRecord,
  PaymentMethod,
  Product,
  ProductionDraftLine,
  ProductionSheet,
  RegisteredSale,
} from '../../domain/types'
import type { SaleLineInput } from '../../domain/registerSaleLines'

type PaymentInfo = {
  paymentMethod: PaymentMethod
  amountPaid: number
  change: number
}

type InventoryContextValue = {
  products: Product[]
  sales: RegisteredSale[]
  productionSheets: ProductionSheet[]
  mermaRecords: MermaRecord[]
  loading: boolean
  serverOnline: boolean
  serverError: string | null
  openShift: { id: string; businessDate: string } | null
  getProduct: (id: string) => Product | undefined
  refresh: () => Promise<void>
  sellLines: (
    lines: SaleLineInput[],
    payment: PaymentInfo,
  ) => Promise<SellLinesResult>
  hasProductionSheetForToday: () => boolean
  lastProductionCreatedAt: string | null
  saveProductionSheet: (
    lines: ProductionDraftLine[],
  ) => Promise<SaveProductionResult>
  applyMerma: (
    productId: string,
    quantity: number,
    reason: string,
  ) => Promise<ApplyMermaResult>
}

const InventoryContext = createContext<InventoryContextValue | null>(null)

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([])
  const [sales, setSales] = useState<RegisteredSale[]>([])
  const [productionSheets, setProductionSheets] = useState<ProductionSheet[]>(
    [],
  )
  const [mermaRecords, setMermaRecords] = useState<MermaRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [serverOnline, setServerOnline] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [openShift, setOpenShift] = useState<{
    id: string
    businessDate: string
  } | null>(null)

  const refresh = useCallback(async () => {
    try {
      const snapshot = await fetchSnapshot()
      setProducts(snapshot.products)
      setSales(snapshot.sales)
      setProductionSheets(snapshot.productionSheets)
      setMermaRecords(snapshot.mermaRecords)
      setOpenShift(
        (snapshot.openShift as { id: string; businessDate: string } | null) ??
          null,
      )
      setServerOnline(true)
      setServerError(null)
    } catch {
      setServerOnline(false)
      setServerError(
        'No se puede conectar con el servidor de Panadería Lela. Verifica que la computadora principal esté encendida y que Iniciar.bat esté en ejecución.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function boot() {
      try {
        if (!wasLegacyMigrated()) {
          const legacy = readLegacyStore()
          if (legacy) {
            await importLegacyStore(legacy)
            markLegacyMigrated()
          } else {
            markLegacyMigrated()
          }
        }
      } catch {
        // Si el servidor aún no arranca, refresh mostrará el error.
      }
      if (!cancelled) await refresh()
    }

    void boot()
    const unsubscribe = subscribeStoreEvents(() => {
      void refresh()
    })
    const poll = window.setInterval(() => {
      void refresh()
    }, 20000)

    return () => {
      cancelled = true
      unsubscribe()
      window.clearInterval(poll)
    }
  }, [refresh])

  const getProduct = useCallback(
    (id: string) => products.find((p) => p.id === id),
    [products],
  )

  const hasProductionSheetForToday = useCallback(() => {
    const today = localDateKey()
    return productionSheets.some((sheet) => sheet.businessDate === today)
  }, [productionSheets])

  const lastProductionCreatedAt = useMemo(() => {
    if (productionSheets.length === 0) return null
    return productionSheets[0]?.createdAt ?? null
  }, [productionSheets])

  const sellLines = useCallback(
    async (
      lines: SaleLineInput[],
      payment: PaymentInfo,
    ): Promise<SellLinesResult> => {
      const result = await postSale({
        lines,
        paymentMethod: payment.paymentMethod,
        amountPaid: payment.amountPaid,
      })
      if (result.ok) await refresh()
      return result
    },
    [refresh],
  )

  const saveProductionSheet = useCallback(
    async (lines: ProductionDraftLine[]): Promise<SaveProductionResult> => {
      const result = await postProduction(lines)
      if (result.ok) await refresh()
      return result
    },
    [refresh],
  )

  const applyMerma = useCallback(
    async (
      productId: string,
      quantity: number,
      reason: string,
    ): Promise<ApplyMermaResult> => {
      const result = await postMerma({
        productId,
        quantity,
        motive: reason,
        reason,
      })
      if (result.ok) await refresh()
      if (result.ok && !('record' in result)) {
        return {
          ok: true,
          record: {
            id: 'id' in result ? String(result.id) : '',
            createdAt: new Date().toISOString(),
            productId,
            productName: '',
            quantity,
            stockBefore: 0,
            stockAfter: 0,
            reason,
          },
        }
      }
      return result as ApplyMermaResult
    },
    [refresh],
  )

  const value = useMemo(
    () => ({
      products,
      sales,
      productionSheets,
      mermaRecords,
      loading,
      serverOnline,
      serverError,
      openShift,
      getProduct,
      refresh,
      sellLines,
      hasProductionSheetForToday,
      lastProductionCreatedAt,
      saveProductionSheet,
      applyMerma,
    }),
    [
      products,
      sales,
      productionSheets,
      mermaRecords,
      loading,
      serverOnline,
      serverError,
      openShift,
      getProduct,
      refresh,
      sellLines,
      hasProductionSheetForToday,
      lastProductionCreatedAt,
      saveProductionSheet,
      applyMerma,
    ],
  )

  return (
    <InventoryContext.Provider value={value}>
      {children}
    </InventoryContext.Provider>
  )
}

export function useInventory() {
  const ctx = useContext(InventoryContext)
  if (!ctx) {
    throw new Error('useInventory debe usarse dentro de InventoryProvider')
  }
  return ctx
}
