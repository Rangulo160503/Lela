import { randomUUID } from 'node:crypto'
import type { AppDatabase } from '../db.js'

export function createMovementsRepo(db: AppDatabase) {
  return {
    insert(input: {
      productId: string
      quantityDelta: number
      reason: string
      referenceType: string
      referenceId: string
      createdAt?: string
    }): void {
      db.prepare(
        `INSERT INTO stock_movements
          (id, created_at, product_id, quantity_delta, reason, reference_type, reference_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        randomUUID(),
        input.createdAt ?? new Date().toISOString(),
        input.productId,
        input.quantityDelta,
        input.reason,
        input.referenceType,
        input.referenceId,
      )
    },
  }
}

export type MovementsRepo = ReturnType<typeof createMovementsRepo>
