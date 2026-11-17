import type { AppDatabase } from '../db.js'
import type { Product } from '../../reglas/types.js'

type ProductRow = {
  id: string
  name: string
  physical_stock: number
  unit_price: number
  photo_path: string | null
}

function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    physicalStock: row.physical_stock,
    unitPrice: row.unit_price,
    photoPath: row.photo_path,
  }
}

export function createProductsRepo(db: AppDatabase) {
  return {
    listActive(): Product[] {
      return db
        .prepare(
          `SELECT id, name, physical_stock, unit_price, photo_path
           FROM products WHERE active = 1 ORDER BY name COLLATE NOCASE`,
        )
        .all()
        .map((row) => mapProduct(row as ProductRow))
    },

    count(): number {
      const row = db.prepare('SELECT COUNT(*) AS n FROM products').get() as {
        n: number
      }
      return row.n
    },

    upsertMany(products: Product[]): void {
      const stmt = db.prepare(`
        INSERT INTO products (id, name, physical_stock, unit_price, active, updated_at, photo_path)
        VALUES (@id, @name, @physicalStock, @unitPrice, 1, @updatedAt, @photoPath)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          physical_stock = excluded.physical_stock,
          unit_price = excluded.unit_price,
          active = 1,
          photo_path = COALESCE(excluded.photo_path, products.photo_path),
          updated_at = excluded.updated_at
      `)
      const now = new Date().toISOString()
      const tx = db.transaction((items: Product[]) => {
        for (const p of items) {
          stmt.run({
            id: p.id,
            name: p.name,
            physicalStock: p.physicalStock,
            unitPrice: p.unitPrice,
            photoPath: p.photoPath ?? null,
            updatedAt: now,
          })
        }
      })
      tx(products)
    },

    /** Asigna foto solo si el producto aún no tiene photo_path */
    ensurePhotos(map: Record<string, string>): void {
      const stmt = db.prepare(`
        UPDATE products
        SET photo_path = ?, updated_at = ?
        WHERE id = ? AND (photo_path IS NULL OR photo_path = '')
      `)
      const now = new Date().toISOString()
      const tx = db.transaction(() => {
        for (const [id, path] of Object.entries(map)) {
          stmt.run(path, now, id)
        }
      })
      tx()
    },

    updateStock(productId: string, physicalStock: number): void {
      db.prepare(
        `UPDATE products SET physical_stock = ?, updated_at = ? WHERE id = ?`,
      ).run(physicalStock, new Date().toISOString(), productId)
    },
  }
}

export type ProductsRepo = ReturnType<typeof createProductsRepo>
