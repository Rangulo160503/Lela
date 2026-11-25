import type { AppDatabase } from '../da/db.js'
import type { ProductsRepo } from '../da/repositories/productsRepo.js'
import { hashPin } from './cryptoAuth.js'
import { SEED_PRODUCTS, seedIfEmpty } from './seed.js'
import { seedPublicProductDetails } from './seedPublicProductDetails.js'

export function seedMvp(db: AppDatabase, products: ProductsRepo): void {
  seedIfEmpty(products)
  seedPublicProductDetails(db)

  const userCount = (
    db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }
  ).n
  if (userCount === 0) {
    const now = new Date().toISOString()
    db.prepare(
      `INSERT INTO users (id, username, display_name, role, pin_hash, active, permissions_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`,
    ).run(
      'user-principal',
      'admin',
      'Administrador principal',
      'principal',
      hashPin('1234'),
      JSON.stringify({ all: true }),
      now,
      now,
    )
    db.prepare(
      `INSERT INTO users (id, username, display_name, role, pin_hash, active, permissions_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`,
    ).run(
      'user-empleado-1',
      'empleado',
      'Empleado',
      'empleado',
      hashPin('0000'),
      JSON.stringify({
        facturacion: true,
        inventario: true,
        produccion: true,
        merma: true,
        caja: true,
        turnos: true,
      }),
      now,
      now,
    )
  }

  const accounts = (
    db.prepare('SELECT COUNT(*) AS n FROM cash_accounts').get() as { n: number }
  ).n
  if (accounts === 0) {
    const insert = db.prepare(
      `INSERT INTO cash_accounts (id, name, kind, balance) VALUES (?, ?, ?, 0)`,
    )
    insert.run('acc-efectivo', 'Efectivo en caja', 'efectivo')
    insert.run('acc-fuerte', 'Caja fuerte', 'caja_fuerte')
    insert.run('acc-banco', 'Cuenta bancaria', 'banco')
    insert.run('acc-sinpe', 'SINPE', 'sinpe')
    insert.run('acc-tarjeta', 'Liquidaciones tarjeta', 'tarjeta')
  }

  const shifts = (
    db.prepare('SELECT COUNT(*) AS n FROM shift_templates').get() as {
      n: number
    }
  ).n
  if (shifts === 0) {
    db.prepare(
      `INSERT INTO shift_templates (id, name, sort_order, active) VALUES (?, ?, ?, 1)`,
    ).run('shift-manana', 'Mañana', 1)
    db.prepare(
      `INSERT INTO shift_templates (id, name, sort_order, active) VALUES (?, ?, ?, 1)`,
    ).run('shift-tarde', 'Tarde', 2)
  }

  // Asegurar presentaciones por defecto
  db.prepare(
    `UPDATE products SET presentation_name = 'Unidad'
     WHERE presentation_name IS NULL OR presentation_name = ''`,
  ).run()

  void SEED_PRODUCTS
}
