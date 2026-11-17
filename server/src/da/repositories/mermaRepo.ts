import type { AppDatabase } from '../db.js'
import type { MermaRecord } from '../../reglas/types.js'

type MermaRow = {
  id: string
  created_at: string
  product_id: string
  product_name: string
  quantity: number
  stock_before: number
  stock_after: number
  reason: string
}

export function createMermaRepo(db: AppDatabase) {
  return {
    list(): MermaRecord[] {
      return (
        db
          .prepare(
            `SELECT id, created_at, product_id, product_name, quantity,
                    stock_before, stock_after, reason
             FROM merma_records ORDER BY created_at DESC`,
          )
          .all() as MermaRow[]
      ).map((row) => ({
        id: row.id,
        createdAt: row.created_at,
        productId: row.product_id,
        productName: row.product_name,
        quantity: row.quantity,
        stockBefore: row.stock_before,
        stockAfter: row.stock_after,
        reason: row.reason,
      }))
    },

    insert(record: MermaRecord): void {
      db.prepare(
        `INSERT INTO merma_records
          (id, created_at, product_id, product_name, quantity, stock_before, stock_after, reason)
         VALUES (@id, @createdAt, @productId, @productName, @quantity, @stockBefore, @stockAfter, @reason)`,
      ).run({
        id: record.id,
        createdAt: record.createdAt,
        productId: record.productId,
        productName: record.productName,
        quantity: record.quantity,
        stockBefore: record.stockBefore,
        stockAfter: record.stockAfter,
        reason: record.reason,
      })
    },
  }
}

export type MermaRepo = ReturnType<typeof createMermaRepo>
