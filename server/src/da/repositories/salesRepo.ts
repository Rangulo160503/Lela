import type { AppDatabase } from '../db.js'
import type { RegisteredSale } from '../../reglas/types.js'

type SaleRow = {
  id: string
  created_at: string
  total: number
  payment_method: RegisteredSale['paymentMethod']
  amount_paid: number
  change_amount: number
}

type LineRow = {
  sale_id: string
  product_id: string
  name: string
  quantity: number
  unit_price: number
  subtotal: number
}

export function createSalesRepo(db: AppDatabase) {
  return {
    list(): RegisteredSale[] {
      const sales = db
        .prepare(
          `SELECT id, created_at, total, payment_method, amount_paid, change_amount
           FROM sales ORDER BY created_at DESC`,
        )
        .all() as SaleRow[]

      const lines = db
        .prepare(
          `SELECT sale_id, product_id, name, quantity, unit_price, subtotal
           FROM sale_lines`,
        )
        .all() as LineRow[]

      const bySale = new Map<string, RegisteredSale['lines']>()
      for (const line of lines) {
        const list = bySale.get(line.sale_id) ?? []
        list.push({
          productId: line.product_id,
          name: line.name,
          quantity: line.quantity,
          unitPrice: line.unit_price,
          subtotal: line.subtotal,
        })
        bySale.set(line.sale_id, list)
      }

      return sales.map((sale) => ({
        id: sale.id,
        createdAt: sale.created_at,
        total: sale.total,
        paymentMethod: sale.payment_method,
        amountPaid: sale.amount_paid,
        change: sale.change_amount,
        lines: bySale.get(sale.id) ?? [],
      }))
    },

    count(): number {
      const row = db.prepare('SELECT COUNT(*) AS n FROM sales').get() as {
        n: number
      }
      return row.n
    },

    insert(sale: RegisteredSale): void {
      const insertSale = db.prepare(`
        INSERT INTO sales (id, created_at, total, payment_method, amount_paid, change_amount)
        VALUES (@id, @createdAt, @total, @paymentMethod, @amountPaid, @change)
      `)
      const insertLine = db.prepare(`
        INSERT INTO sale_lines (sale_id, product_id, name, quantity, unit_price, subtotal)
        VALUES (@saleId, @productId, @name, @quantity, @unitPrice, @subtotal)
      `)

      const tx = db.transaction((item: RegisteredSale) => {
        insertSale.run({
          id: item.id,
          createdAt: item.createdAt,
          total: item.total,
          paymentMethod: item.paymentMethod,
          amountPaid: item.amountPaid,
          change: item.change,
        })
        for (const line of item.lines) {
          insertLine.run({
            saleId: item.id,
            productId: line.productId,
            name: line.name,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            subtotal: line.subtotal,
          })
        }
      })
      tx(sale)
    },
  }
}

export type SalesRepo = ReturnType<typeof createSalesRepo>
