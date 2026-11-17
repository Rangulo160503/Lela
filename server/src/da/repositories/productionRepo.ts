import type { AppDatabase } from '../db.js'
import type { ProductionSheet } from '../../reglas/types.js'

type SheetRow = {
  id: string
  business_date: string
  created_at: string
}

type LineRow = {
  sheet_id: string
  product_id: string
  name: string
  sold: number
  stock_before: number
  quantity: number
}

export function createProductionRepo(db: AppDatabase) {
  return {
    list(): ProductionSheet[] {
      const sheets = db
        .prepare(
          `SELECT id, business_date, created_at
           FROM production_sheets ORDER BY created_at DESC`,
        )
        .all() as SheetRow[]

      const lines = db
        .prepare(
          `SELECT sheet_id, product_id, name, sold, stock_before, quantity
           FROM production_lines`,
        )
        .all() as LineRow[]

      const bySheet = new Map<string, ProductionSheet['lines']>()
      for (const line of lines) {
        const list = bySheet.get(line.sheet_id) ?? []
        list.push({
          productId: line.product_id,
          name: line.name,
          sold: line.sold,
          stockBefore: line.stock_before,
          quantity: line.quantity,
        })
        bySheet.set(line.sheet_id, list)
      }

      return sheets.map((sheet) => ({
        id: sheet.id,
        businessDate: sheet.business_date,
        createdAt: sheet.created_at,
        lines: bySheet.get(sheet.id) ?? [],
      }))
    },

    hasBusinessDate(businessDate: string): boolean {
      const row = db
        .prepare(
          `SELECT 1 AS ok FROM production_sheets WHERE business_date = ? LIMIT 1`,
        )
        .get(businessDate) as { ok: number } | undefined
      return Boolean(row)
    },

    insert(sheet: ProductionSheet): void {
      const insertSheet = db.prepare(`
        INSERT INTO production_sheets (id, business_date, created_at)
        VALUES (@id, @businessDate, @createdAt)
      `)
      const insertLine = db.prepare(`
        INSERT INTO production_lines
          (sheet_id, product_id, name, sold, stock_before, quantity)
        VALUES (@sheetId, @productId, @name, @sold, @stockBefore, @quantity)
      `)

      const tx = db.transaction((item: ProductionSheet) => {
        insertSheet.run({
          id: item.id,
          businessDate: item.businessDate,
          createdAt: item.createdAt,
        })
        for (const line of item.lines) {
          insertLine.run({
            sheetId: item.id,
            productId: line.productId,
            name: line.name,
            sold: line.sold,
            stockBefore: line.stockBefore,
            quantity: line.quantity,
          })
        }
      })
      tx(sheet)
    },
  }
}

export type ProductionRepo = ReturnType<typeof createProductionRepo>
