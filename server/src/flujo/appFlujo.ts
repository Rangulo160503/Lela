import { randomUUID } from 'node:crypto'
import type { IAppFlujo } from '../abstracciones/ports.js'
import { DB_PATH, PORT, getLanAddresses } from '../config.js'
import type { AppDatabase } from '../da/db.js'
import type { MermaRepo } from '../da/repositories/mermaRepo.js'
import type { MovementsRepo } from '../da/repositories/movementsRepo.js'
import type { ProductionRepo } from '../da/repositories/productionRepo.js'
import type { ProductsRepo } from '../da/repositories/productsRepo.js'
import type { SalesRepo } from '../da/repositories/salesRepo.js'
import { buildProforma } from '../reglas/buildProforma.js'
import {
  buildProductionDraft,
  localDateKey,
} from '../reglas/buildProductionDraft.js'
import { validatePayment } from '../reglas/payment.js'
import { registerMerma } from '../reglas/registerMerma.js'
import { registerSaleLines } from '../reglas/registerSaleLines.js'
import type {
  LegacyStore,
  MermaRecord,
  ProductionDraftLine,
  ProductionSheet,
  RegisteredSale,
} from '../reglas/types.js'
import { publish } from '../servicios/eventBus.js'

type Deps = {
  db: AppDatabase
  products: ProductsRepo
  sales: SalesRepo
  production: ProductionRepo
  merma: MermaRepo
  movements: MovementsRepo
}

type FailResult = { ok: false; error: string; productId?: string }

export function createAppFlujo(deps: Deps): IAppFlujo {
  function notify(): void {
    publish('store-changed')
  }

  return {
    getSystemInfo() {
      return {
        ok: true,
        port: PORT,
        lanAddresses: getLanAddresses(),
        dbPath: DB_PATH,
        serverTime: new Date().toISOString(),
      }
    },

    getSnapshot() {
      return {
        products: deps.products.listActive(),
        sales: deps.sales.list(),
        productionSheets: deps.production.list(),
        mermaRecords: deps.merma.list(),
        serverTime: new Date().toISOString(),
      }
    },

    sellLines(input) {
      const quantities = Object.fromEntries(
        input.lines
          .filter((line) => line.quantity > 0)
          .map((line) => [line.productId, line.quantity]),
      )

      let sale: RegisteredSale | null = null

      const tx = deps.db.transaction(() => {
        const fresh = deps.products.listActive()
        const stockResult = registerSaleLines(fresh, input.lines)
        if (!stockResult.ok) {
          throw Object.assign(new Error('sell_failed'), { result: stockResult })
        }

        const proforma = buildProforma(fresh, quantities)
        const total =
          typeof input.totalOverride === 'number'
            ? input.totalOverride
            : proforma.total
        const lines =
          input.saleLabel && typeof input.totalOverride === 'number'
            ? [
                {
                  productId: 'promo',
                  name: input.saleLabel,
                  quantity: 1,
                  unitPrice: total,
                  subtotal: total,
                },
                ...proforma.lines.map((l) => ({
                  ...l,
                  unitPrice: 0,
                  subtotal: 0,
                  name: `${l.name} (comp.)`,
                })),
              ]
            : proforma.lines
        const paid = validatePayment(
          total,
          input.paymentMethod,
          input.amountPaid,
        )
        if (!paid.ok) {
          throw Object.assign(new Error('pay_failed'), { result: paid })
        }

        sale = {
          id: randomUUID(),
          createdAt: new Date().toISOString(),
          lines,
          total,
          paymentMethod: input.paymentMethod,
          amountPaid: paid.amountPaid,
          change: paid.change,
        }

        for (const product of stockResult.nextProducts) {
          const before = fresh.find((p) => p.id === product.id)
          if (!before || before.physicalStock === product.physicalStock) continue
          deps.products.updateStock(product.id, product.physicalStock)
          deps.movements.insert({
            productId: product.id,
            quantityDelta: product.physicalStock - before.physicalStock,
            reason: 'venta',
            referenceType: 'sale',
            referenceId: sale.id,
            createdAt: sale.createdAt,
          })
        }
        deps.sales.insert(sale)
      })

      try {
        tx()
      } catch (err) {
        const result = (err as { result?: FailResult })?.result
        if (result && result.ok === false) {
          return result as ReturnType<IAppFlujo['sellLines']>
        }
        throw err
      }

      notify()
      return { ok: true, sale: sale! }
    },

    saveProductionSheet(lines: ProductionDraftLine[]) {
      const today = localDateKey()
      for (const line of lines) {
        if (!Number.isInteger(line.quantity) || line.quantity < 0) {
          return { ok: false, error: 'invalid_quantity' }
        }
      }

      const sheet: ProductionSheet = {
        id: randomUUID(),
        businessDate: today,
        createdAt: new Date().toISOString(),
        lines: lines.map((line) => ({
          productId: line.productId,
          name: line.name,
          sold: line.sold,
          stockBefore: line.stock,
          quantity: line.quantity,
        })),
      }

      const tx = deps.db.transaction(() => {
        if (deps.production.hasBusinessDate(today)) {
          throw Object.assign(new Error('already'), {
            result: { ok: false, error: 'already_saved_today' as const },
          })
        }
        const current = deps.products.listActive()
        for (const line of lines) {
          if (line.quantity === 0) continue
          const product = current.find((p) => p.id === line.productId)
          if (!product) continue
          deps.products.updateStock(
            product.id,
            product.physicalStock + line.quantity,
          )
          deps.movements.insert({
            productId: product.id,
            quantityDelta: line.quantity,
            reason: 'produccion',
            referenceType: 'production',
            referenceId: sheet.id,
            createdAt: sheet.createdAt,
          })
        }
        deps.production.insert(sheet)
      })

      try {
        tx()
      } catch (err) {
        const result = (
          err as { result?: { ok: false; error: 'already_saved_today' } }
        )?.result
        if (result) return result
        throw err
      }

      notify()
      return { ok: true, sheet }
    },

    applyMerma(productId, quantity, reason) {
      const trimmed = reason.trim() || 'Producto malo'
      let record: MermaRecord | null = null

      const tx = deps.db.transaction(() => {
        const fresh = deps.products.listActive()
        const again = registerMerma(fresh, productId, quantity)
        if (!again.ok) {
          throw Object.assign(new Error('merma_failed'), { result: again })
        }
        const product = fresh.find((p) => p.id === productId)
        if (!product) {
          throw Object.assign(new Error('merma_failed'), {
            result: { ok: false, error: 'product_not_found' as const },
          })
        }
        const next = again.nextProducts.find((p) => p.id === productId)!
        record = {
          id: randomUUID(),
          createdAt: new Date().toISOString(),
          productId,
          productName: product.name,
          quantity,
          stockBefore: again.stockBefore,
          stockAfter: again.stockBefore - quantity,
          reason: trimmed,
        }
        deps.products.updateStock(productId, next.physicalStock)
        deps.movements.insert({
          productId,
          quantityDelta: -quantity,
          reason: trimmed,
          referenceType: 'merma',
          referenceId: record.id,
          createdAt: record.createdAt,
        })
        deps.merma.insert(record)
      })

      try {
        tx()
      } catch (err) {
        const fail = (err as { result?: FailResult })?.result
        if (fail && fail.ok === false) {
          return fail as ReturnType<IAppFlujo['applyMerma']>
        }
        throw err
      }

      notify()
      return { ok: true, record: record! }
    },

    importLegacy(store: LegacyStore) {
      if (
        deps.sales.count() > 0 ||
        deps.production.list().length > 0 ||
        deps.merma.list().length > 0
      ) {
        return {
          ok: true,
          imported: false,
          reason: 'La base ya tiene movimientos; no se sobrescribe.',
        }
      }

      const tx = deps.db.transaction(() => {
        if (store.products?.length) {
          deps.products.upsertMany(store.products)
        }
        for (const sale of store.sales ?? []) {
          deps.sales.insert({
            ...sale,
            paymentMethod: sale.paymentMethod ?? 'efectivo',
            amountPaid: sale.amountPaid ?? sale.total,
            change: sale.change ?? 0,
          })
        }
        for (const sheet of store.productionSheets ?? []) {
          deps.production.insert(sheet)
        }
        for (const record of store.mermaRecords ?? []) {
          deps.merma.insert(record)
        }
      })
      tx()
      notify()
      return { ok: true, imported: true }
    },

    buildProductionDraft() {
      const sheets = deps.production.list()
      const lastCreated = sheets[0]?.createdAt ?? null
      return buildProductionDraft(
        deps.products.listActive(),
        deps.sales.list(),
        lastCreated,
      )
    },
  }
}
