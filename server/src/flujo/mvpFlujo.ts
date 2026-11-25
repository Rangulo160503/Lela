import { randomUUID } from 'node:crypto'
import type { AppDatabase } from '../da/db.js'
import { publish } from '../servicios/eventBus.js'
import { hashPin, newToken, verifyPin } from '../servicios/cryptoAuth.js'
import {
  applyRestoreReplace,
  createBackup,
  listBackups,
  prepareRestore,
} from '../servicios/backup.js'
import {
  detectConnectionHint,
  formatSaleTicket,
  getPrinterSettings,
  listWindowsPrinters,
  printText,
  savePrinterSettings,
} from '../servicios/printService.js'
import {
  getBakeryPublic,
  saveBakeryPublic,
  type BakeryPublicInfo,
} from '../servicios/bakeryPublic.js'
import type { RegisteredSale } from '../reglas/types.js'
import { registerMerma } from '../reglas/registerMerma.js'
import type { ProductsRepo } from '../da/repositories/productsRepo.js'
import type { SalesRepo } from '../da/repositories/salesRepo.js'

type UserRow = {
  id: string
  username: string
  display_name: string
  role: 'principal' | 'admin' | 'empleado'
  pin_hash: string
  active: number
  permissions_json: string
}

function notify() {
  publish('store-changed')
}

function publicUser(u: UserRow) {
  return {
    id: u.id,
    username: u.username,
    displayName: u.display_name,
    role: u.role,
    active: u.active === 1,
    permissions: JSON.parse(u.permissions_json || '{}') as Record<
      string,
      boolean
    >,
  }
}

export function createMvpFlujo(deps: {
  db: AppDatabase
  products: ProductsRepo
  sales: SalesRepo
  reopenDb: () => AppDatabase
}) {
  const { reopenDb } = deps

  return {

    login(username: string, pin: string) {
      const user = deps.db
        .prepare(`SELECT * FROM users WHERE username = ? COLLATE NOCASE`)
        .get(username.trim()) as UserRow | undefined
      if (!user || user.active !== 1 || !verifyPin(pin, user.pin_hash)) {
        return { ok: false as const, error: 'invalid_credentials' }
      }
      const token = newToken()
      const expires = new Date(Date.now() + 1000 * 60 * 60 * 16).toISOString()
      deps.db.prepare(
        `INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`,
      ).run(token, user.id, new Date().toISOString(), expires)
      return { ok: true as const, token, user: publicUser(user), expiresAt: expires }
    },

    logout(token: string) {
      deps.db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token)
      return { ok: true as const }
    },

    sessionUser(token: string | undefined) {
      if (!token) return null
      const row = deps.db
        .prepare(
          `SELECT u.* FROM sessions s
           JOIN users u ON u.id = s.user_id
           WHERE s.token = ? AND s.expires_at > ? AND u.active = 1`,
        )
        .get(token, new Date().toISOString()) as UserRow | undefined
      return row ? publicUser(row) : null
    },

    listUsers() {
      return (
        deps.db.prepare(`SELECT * FROM users ORDER BY display_name COLLATE NOCASE`).all() as UserRow[]
      ).map(publicUser)
    },

    upsertUser(input: {
      id?: string
      username: string
      displayName: string
      role: 'principal' | 'admin' | 'empleado'
      pin?: string
      active?: boolean
      permissions?: Record<string, boolean>
      actorRole: string
    }) {
      if (input.role === 'principal' && input.actorRole !== 'principal') {
        return { ok: false as const, error: 'only_principal' }
      }
      const now = new Date().toISOString()
      const id = input.id ?? randomUUID()
      const existing = deps.db
        .prepare(`SELECT * FROM users WHERE id = ?`)
        .get(id) as UserRow | undefined
      const pinHash = input.pin
        ? hashPin(input.pin)
        : existing?.pin_hash ?? hashPin('0000')
      const permissions = JSON.stringify(input.permissions ?? { facturacion: true })
      if (existing) {
        deps.db.prepare(
          `UPDATE users SET username=?, display_name=?, role=?, pin_hash=?, active=?, permissions_json=?, updated_at=?
           WHERE id=?`,
        ).run(
          input.username,
          input.displayName,
          input.role,
          pinHash,
          input.active === false ? 0 : 1,
          permissions,
          now,
          id,
        )
      } else {
        deps.db.prepare(
          `INSERT INTO users (id, username, display_name, role, pin_hash, active, permissions_json, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          id,
          input.username,
          input.displayName,
          input.role,
          pinHash,
          input.active === false ? 0 : 1,
          permissions,
          now,
          now,
        )
      }
      notify()
      return { ok: true as const, id }
    },

    upsertProduct(input: {
      id?: string
      name: string
      unitPrice: number
      physicalStock?: number
      description?: string
      presentationName?: string
      active?: boolean
      photoPath?: string | null
      actorId?: string
    }) {
      const id = input.id ?? randomUUID()
      const existing = deps.products.listActive().find((p) => p.id === id)
      const all = deps.db
        .prepare(`SELECT id, unit_price, name, physical_stock FROM products WHERE id=?`)
        .get(id) as
        | { id: string; unit_price: number; name: string; physical_stock: number }
        | undefined
      const now = new Date().toISOString()
      if (all) {
        if (all.unit_price !== input.unitPrice) {
          deps.db.prepare(
            `INSERT INTO price_history (id, product_id, old_price, new_price, changed_by, created_at, note)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          ).run(
            randomUUID(),
            id,
            all.unit_price,
            input.unitPrice,
            input.actorId ?? null,
            now,
            'Cambio de precio',
          )
        }
        deps.db.prepare(
          `UPDATE products SET name=?, unit_price=?, physical_stock=COALESCE(?, physical_stock),
            description=?, presentation_name=?, active=?, photo_path=COALESCE(?, photo_path), updated_at=?
           WHERE id=?`,
        ).run(
          input.name,
          input.unitPrice,
          input.physicalStock ?? null,
          input.description ?? '',
          input.presentationName ?? 'Unidad',
          input.active === false ? 0 : 1,
          input.photoPath ?? null,
          now,
          id,
        )
      } else {
        deps.db.prepare(
          `INSERT INTO products (id, name, physical_stock, unit_price, active, updated_at, description, presentation_name, photo_path)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          id,
          input.name,
          input.physicalStock ?? 0,
          input.unitPrice,
          input.active === false ? 0 : 1,
          now,
          input.description ?? '',
          input.presentationName ?? 'Unidad',
          input.photoPath ?? null,
        )
      }
      void existing
      notify()
      return { ok: true as const, id }
    },

    listProductsAdmin() {
      return deps.db
        .prepare(
          `SELECT id, name, physical_stock as physicalStock, unit_price as unitPrice,
                  active, description, presentation_name as presentationName, photo_path as photoPath
           FROM products ORDER BY name COLLATE NOCASE`,
        )
        .all()
    },

    /** Catálogo público (vitrina): sin stock ni flags internos. */
    listPublicMenu() {
      const rows = deps.db
        .prepare(
          `SELECT id, name, unit_price as unitPrice,
                  description, presentation_name as presentationName, photo_path as photoPath,
                  ingredients_public as ingredientsPublic, nutrition_json as nutritionJson
           FROM products
           WHERE active = 1
           ORDER BY name COLLATE NOCASE`,
        )
        .all() as Array<{
          id: string
          name: string
          unitPrice: number
          description: string | null
          presentationName: string | null
          photoPath: string | null
          ingredientsPublic: string | null
          nutritionJson: string | null
        }>

      return rows.map((row) => {
        const ingredients = String(row.ingredientsPublic || '')
          .split(/,|\n/)
          .map((s) => s.trim())
          .filter(Boolean)
        let nutrition: {
          portion: string
          kcal: number
          protein: number
          carbs: number
          fat: number
          fiber: number
          sodium: number
        } | null = null
        if (row.nutritionJson) {
          try {
            nutrition = JSON.parse(row.nutritionJson)
          } catch {
            nutrition = null
          }
        }
        return {
          id: row.id,
          name: row.name,
          unitPrice: row.unitPrice,
          description: row.description,
          presentationName: row.presentationName,
          photoPath: row.photoPath,
          ingredients,
          nutrition,
        }
      })
    },

    listRawMaterials() {
      return deps.db
        .prepare(
          `SELECT id, name, unit, stock, avg_cost as avgCost, active, photo_path as photoPath,
                  pack_size_kg as packSizeKg, pack_price as packPrice
           FROM raw_materials ORDER BY name COLLATE NOCASE`,
        )
        .all()
    },

    upsertRawMaterial(input: {
      id?: string
      name: string
      unit: string
      stock?: number
      avgCost?: number
      packSizeKg?: number
      packPrice?: number
      active?: boolean
      photoPath?: string | null
    }) {
      const id = input.id ?? randomUUID()
      const now = new Date().toISOString()
      const existing = deps.db
        .prepare(
          `SELECT pack_size_kg as packSizeKg, pack_price as packPrice, avg_cost as avgCost
           FROM raw_materials WHERE id=?`,
        )
        .get(id) as
        | { packSizeKg: number; packPrice: number; avgCost: number }
        | undefined

      const packSizeKg =
        typeof input.packSizeKg === 'number' && input.packSizeKg > 0
          ? input.packSizeKg
          : existing?.packSizeKg && existing.packSizeKg > 0
            ? existing.packSizeKg
            : 1

      let packPrice =
        typeof input.packPrice === 'number' && input.packPrice >= 0
          ? input.packPrice
          : (existing?.packPrice ?? 0)

      let avgCost =
        typeof input.avgCost === 'number' && input.avgCost >= 0
          ? input.avgCost
          : (existing?.avgCost ?? 0)

      // Si mandan saco (tamaño + precio), ₡/kg = precio ÷ kg
      if (
        typeof input.packSizeKg === 'number' &&
        input.packSizeKg > 0 &&
        typeof input.packPrice === 'number' &&
        input.packPrice >= 0
      ) {
        packPrice = input.packPrice
        avgCost = input.packPrice / input.packSizeKg
      } else if (
        typeof input.avgCost === 'number' &&
        input.avgCost >= 0 &&
        packSizeKg > 0
      ) {
        // Ajuste de ₡/kg (p. ej. desde receta): mantener saco y recalcular precio del paquete
        avgCost = input.avgCost
        packPrice = input.avgCost * packSizeKg
      }

      if (existing) {
        deps.db.prepare(
          `UPDATE raw_materials SET name=?, unit=?, stock=COALESCE(?, stock), avg_cost=?,
            pack_size_kg=?, pack_price=?, active=?, photo_path=COALESCE(?, photo_path), updated_at=?
           WHERE id=?`,
        ).run(
          input.name,
          input.unit,
          input.stock ?? null,
          avgCost,
          packSizeKg,
          packPrice,
          input.active === false ? 0 : 1,
          input.photoPath ?? null,
          now,
          id,
        )
      } else {
        deps.db.prepare(
          `INSERT INTO raw_materials
            (id, name, unit, stock, avg_cost, active, updated_at, photo_path, pack_size_kg, pack_price)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          id,
          input.name,
          input.unit,
          input.stock ?? 0,
          avgCost,
          input.active === false ? 0 : 1,
          now,
          input.photoPath ?? null,
          packSizeKg,
          packPrice,
        )
      }
      notify()
      return { ok: true as const, id, avgCost, packSizeKg, packPrice }
    },

    listRecipes() {
      const recipes = deps.db
        .prepare(
          `SELECT id, product_id as productId, name, version, official, active,
                  created_at as createdAt, notes, photo_path as photoPath,
                  batch_yield as batchYield
           FROM recipes ORDER BY name COLLATE NOCASE, version DESC`,
        )
        .all() as Array<{ id: string }>
      return recipes.map((r) => ({
        ...r,
        ingredients: deps.db
          .prepare(
            `SELECT raw_material_id as rawMaterialId, quantity FROM recipe_ingredients WHERE recipe_id=?`,
          )
          .all(r.id),
      }))
    },

    saveRecipe(input: {
      id?: string
      productId: string
      name: string
      notes?: string
      photoPath?: string | null
      batchYield?: number
      official?: boolean
      active?: boolean
      ingredients: { rawMaterialId: string; quantity: number }[]
    }) {
      const id = input.id ?? randomUUID()
      const batchYield =
        typeof input.batchYield === 'number' && input.batchYield > 0
          ? input.batchYield
          : 1
      const versionRow = deps.db
        .prepare(
          `SELECT COALESCE(MAX(version),0) as v FROM recipes WHERE product_id=?`,
        )
        .get(input.productId) as { v: number }
      const version = input.id
        ? ((
            deps.db.prepare(`SELECT version FROM recipes WHERE id=?`).get(id) as
              | { version: number }
              | undefined
          )?.version ?? 1)
        : versionRow.v + 1
      const tx = deps.db.transaction(() => {
        if (!input.id) {
          deps.db.prepare(
            `INSERT INTO recipes (id, product_id, name, version, official, active, created_at, notes, photo_path, batch_yield)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ).run(
            id,
            input.productId,
            input.name,
            version,
            input.official === false ? 0 : 1,
            input.active === false ? 0 : 1,
            new Date().toISOString(),
            input.notes ?? '',
            input.photoPath ?? null,
            batchYield,
          )
        } else {
          deps.db.prepare(
            `UPDATE recipes SET name=?, official=?, notes=?, photo_path=COALESCE(?, photo_path),
              active=?, batch_yield=? WHERE id=?`,
          ).run(
            input.name,
            input.official === false ? 0 : 1,
            input.notes ?? '',
            input.photoPath ?? null,
            input.active === false ? 0 : 1,
            batchYield,
            id,
          )
          deps.db.prepare(`DELETE FROM recipe_ingredients WHERE recipe_id=?`).run(id)
        }
        const ins = deps.db.prepare(
          `INSERT INTO recipe_ingredients (recipe_id, raw_material_id, quantity) VALUES (?, ?, ?)`,
        )
        for (const ing of input.ingredients) {
          if (!ing.rawMaterialId) continue
          ins.run(id, ing.rawMaterialId, ing.quantity)
        }
      })
      tx()
      notify()
      return { ok: true as const, id, version }
    },

    createProductionPlan(input: {
      businessDate: string
      notes?: string
      createdBy?: string
      lines: { productId: string; plannedQty: number; recipeId?: string }[]
    }) {
      const id = randomUUID()
      const tx = deps.db.transaction(() => {
        deps.db.prepare(
          `INSERT INTO production_plans (id, business_date, created_at, created_by, status, notes)
           VALUES (?, ?, ?, ?, 'planned', ?)`,
        ).run(
          id,
          input.businessDate,
          new Date().toISOString(),
          input.createdBy ?? null,
          input.notes ?? '',
        )
        const ins = deps.db.prepare(
          `INSERT INTO production_plan_lines (plan_id, product_id, planned_qty, recipe_id)
           VALUES (?, ?, ?, ?)`,
        )
        for (const line of input.lines) {
          ins.run(id, line.productId, line.plannedQty, line.recipeId ?? null)
        }
      })
      tx()
      notify()
      return { ok: true as const, id }
    },

    confirmProductionPlan(planId: string, confirmed: { productId: string; qty: number }[]) {
      const plan = deps.db
        .prepare(`SELECT * FROM production_plans WHERE id=?`)
        .get(planId) as { id: string; status: string } | undefined
      if (!plan) return { ok: false as const, error: 'not_found' }
      if (plan.status === 'confirmed') {
        return { ok: false as const, error: 'already_confirmed' }
      }

      const tx = deps.db.transaction(() => {
        for (const line of confirmed) {
          deps.db.prepare(
            `UPDATE production_plan_lines SET confirmed_qty=? WHERE plan_id=? AND product_id=?`,
          ).run(line.qty, planId, line.productId)

          const product = deps.products.listActive().find((p) => p.id === line.productId)
          if (product && line.qty > 0) {
            deps.products.updateStock(product.id, product.physicalStock + line.qty)
            deps.db.prepare(
              `INSERT INTO stock_movements
                (id, created_at, product_id, quantity_delta, reason, reference_type, reference_id)
               VALUES (?, ?, ?, ?, 'produccion_confirmada', 'production_plan', ?)`,
            ).run(randomUUID(), new Date().toISOString(), product.id, line.qty, planId)
          }

          // Consumo teórico de MP por receta oficial activa
          const recipe = deps.db
            .prepare(
              `SELECT id FROM recipes WHERE product_id=? AND official=1 AND active=1
               ORDER BY version DESC LIMIT 1`,
            )
            .get(line.productId) as { id: string } | undefined
          if (recipe && line.qty > 0) {
            const recipeMeta = deps.db
              .prepare(`SELECT batch_yield as batchYield FROM recipes WHERE id=?`)
              .get(recipe.id) as { batchYield: number } | undefined
            const batchYield =
              recipeMeta && recipeMeta.batchYield > 0 ? recipeMeta.batchYield : 1
            // quantity = % panadero sobre 1 kg de base (100% = 1 kg).
            // Por cada unidad terminada: kg = (%/100) / batch_yield
            const ings = deps.db
              .prepare(
                `SELECT raw_material_id as rawMaterialId, quantity FROM recipe_ingredients WHERE recipe_id=?`,
              )
              .all(recipe.id) as { rawMaterialId: string; quantity: number }[]
            for (const ing of ings) {
              const kgPerUnit = ing.quantity / 100 / batchYield
              const consume = kgPerUnit * line.qty
              deps.db.prepare(
                `UPDATE raw_materials SET stock = MAX(0, stock - ?), updated_at=? WHERE id=?`,
              ).run(consume, new Date().toISOString(), ing.rawMaterialId)
            }
          }
        }
        deps.db.prepare(
          `UPDATE production_plans SET status='confirmed' WHERE id=?`,
        ).run(planId)
      })
      tx()
      notify()
      return { ok: true as const }
    },

    listProductionPlans() {
      const plans = deps.db
        .prepare(
          `SELECT id, business_date as businessDate, created_at as createdAt, status, notes
           FROM production_plans ORDER BY created_at DESC`,
        )
        .all() as Array<{ id: string }>
      return plans.map((p) => ({
        ...p,
        lines: deps.db
          .prepare(
            `SELECT product_id as productId, planned_qty as plannedQty,
                    confirmed_qty as confirmedQty, recipe_id as recipeId
             FROM production_plan_lines WHERE plan_id=?`,
          )
          .all(p.id),
      }))
    },

    listSuppliers() {
      return deps.db
        .prepare(
          `SELECT id, name, phone, notes, active, created_at as createdAt FROM suppliers ORDER BY name`,
        )
        .all()
    },

    upsertSupplier(input: {
      id?: string
      name: string
      phone?: string
      notes?: string
      active?: boolean
    }) {
      const id = input.id ?? randomUUID()
      const exists = deps.db.prepare(`SELECT id FROM suppliers WHERE id=?`).get(id)
      if (exists) {
        deps.db.prepare(
          `UPDATE suppliers SET name=?, phone=?, notes=?, active=? WHERE id=?`,
        ).run(
          input.name,
          input.phone ?? '',
          input.notes ?? '',
          input.active === false ? 0 : 1,
          id,
        )
      } else {
        deps.db.prepare(
          `INSERT INTO suppliers (id, name, phone, notes, active, created_at) VALUES (?, ?, ?, ?, 1, ?)`,
        ).run(
          id,
          input.name,
          input.phone ?? '',
          input.notes ?? '',
          new Date().toISOString(),
        )
      }
      notify()
      return { ok: true as const, id }
    },

    registerPurchase(input: {
      supplierId?: string
      invoiceNumber?: string
      purchasedAt?: string
      paymentAccount?: string
      dueDate?: string
      photoPath?: string
      notes?: string
      createdBy?: string
      lines: {
        rawMaterialId: string
        name: string
        quantity: number
        unitCost: number
      }[]
      payNow?: number
    }) {
      const id = randomUUID()
      const total = input.lines.reduce(
        (s, l) => s + l.quantity * l.unitCost,
        0,
      )
      const paid = input.payNow ?? 0
      const tx = deps.db.transaction(() => {
        deps.db.prepare(
          `INSERT INTO purchases
            (id, supplier_id, invoice_number, purchased_at, total, paid_amount, payment_account, due_date, photo_path, notes, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          id,
          input.supplierId ?? null,
          input.invoiceNumber ?? '',
          input.purchasedAt ?? new Date().toISOString(),
          total,
          paid,
          input.paymentAccount ?? null,
          input.dueDate ?? null,
          input.photoPath ?? null,
          input.notes ?? '',
          input.createdBy ?? null,
          new Date().toISOString(),
        )
        const ins = deps.db.prepare(
          `INSERT INTO purchase_lines (purchase_id, raw_material_id, name, quantity, unit_cost, subtotal)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        for (const line of input.lines) {
          const sub = line.quantity * line.unitCost
          ins.run(id, line.rawMaterialId, line.name, line.quantity, line.unitCost, sub)
          deps.db.prepare(
            `UPDATE raw_materials
             SET stock = stock + ?, avg_cost = ?, updated_at=?
             WHERE id=?`,
          ).run(line.quantity, line.unitCost, new Date().toISOString(), line.rawMaterialId)
        }
        if (paid > 0 && input.paymentAccount) {
          deps.db.prepare(
            `UPDATE cash_accounts SET balance = balance - ? WHERE id=?`,
          ).run(paid, input.paymentAccount)
          deps.db.prepare(
            `INSERT INTO cash_movements
              (id, account_id, amount, direction, category, reference_type, reference_id, note, created_by, created_at)
             VALUES (?, ?, ?, 'out', 'compra', 'purchase', ?, ?, ?, ?)`,
          ).run(
            randomUUID(),
            input.paymentAccount,
            paid,
            id,
            'Pago compra',
            input.createdBy ?? null,
            new Date().toISOString(),
          )
        }
      })
      tx()
      notify()
      return { ok: true as const, id, total }
    },

    listPurchases() {
      return deps.db
        .prepare(
          `SELECT id, supplier_id as supplierId, invoice_number as invoiceNumber,
                  purchased_at as purchasedAt, total, paid_amount as paidAmount,
                  payment_account as paymentAccount, due_date as dueDate,
                  photo_path as photoPath, notes, created_at as createdAt
           FROM purchases ORDER BY purchased_at DESC`,
        )
        .all()
    },

    paySupplier(input: {
      supplierId: string
      purchaseId?: string
      amount: number
      accountId: string
      note?: string
      createdBy?: string
    }) {
      const id = randomUUID()
      const tx = deps.db.transaction(() => {
        deps.db.prepare(
          `INSERT INTO supplier_payments (id, supplier_id, purchase_id, amount, paid_at, account, note, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          id,
          input.supplierId,
          input.purchaseId ?? null,
          input.amount,
          new Date().toISOString(),
          input.accountId,
          input.note ?? '',
          input.createdBy ?? null,
        )
        if (input.purchaseId) {
          deps.db.prepare(
            `UPDATE purchases SET paid_amount = paid_amount + ? WHERE id=?`,
          ).run(input.amount, input.purchaseId)
        }
        deps.db.prepare(
          `UPDATE cash_accounts SET balance = balance - ? WHERE id=?`,
        ).run(input.amount, input.accountId)
        deps.db.prepare(
          `INSERT INTO cash_movements
            (id, account_id, amount, direction, category, reference_type, reference_id, note, created_by, created_at)
           VALUES (?, ?, ?, 'out', 'pago_proveedor', 'supplier_payment', ?, ?, ?, ?)`,
        ).run(
          randomUUID(),
          input.accountId,
          input.amount,
          id,
          input.note ?? 'Pago proveedor',
          input.createdBy ?? null,
          new Date().toISOString(),
        )
      })
      tx()
      notify()
      return { ok: true as const, id }
    },

    listAccounts() {
      return deps.db
        .prepare(
          `SELECT id, name, kind, balance FROM cash_accounts ORDER BY name`,
        )
        .all()
    },

    listExpenses(opts?: { sinceIso?: string; untilIso?: string; limit?: number }) {
      const limit = Math.min(Math.max(opts?.limit ?? 80, 1), 200)
      if (opts?.sinceIso && opts?.untilIso) {
        return deps.db
          .prepare(
            `SELECT id, description, amount, account_id as accountId, category,
                    photo_path as photoPath, created_at as createdAt
             FROM expenses
             WHERE created_at >= ? AND created_at <= ?
             ORDER BY created_at DESC LIMIT ?`,
          )
          .all(opts.sinceIso, opts.untilIso, limit)
      }
      if (opts?.sinceIso) {
        return deps.db
          .prepare(
            `SELECT id, description, amount, account_id as accountId, category,
                    photo_path as photoPath, created_at as createdAt
             FROM expenses
             WHERE created_at >= ?
             ORDER BY created_at DESC LIMIT ?`,
          )
          .all(opts.sinceIso, limit)
      }
      return deps.db
        .prepare(
          `SELECT id, description, amount, account_id as accountId, category,
                  photo_path as photoPath, created_at as createdAt
           FROM expenses
           ORDER BY created_at DESC LIMIT ?`,
        )
        .all(limit)
    },

    registerExpense(input: {
      description: string
      amount: number
      accountId: string
      category?: string
      photoPath?: string
      createdBy?: string
    }) {
      const id = randomUUID()
      const tx = deps.db.transaction(() => {
        deps.db.prepare(
          `INSERT INTO expenses (id, description, amount, account_id, category, photo_path, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          id,
          input.description,
          input.amount,
          input.accountId,
          input.category ?? 'general',
          input.photoPath ?? null,
          input.createdBy ?? null,
          new Date().toISOString(),
        )
        deps.db.prepare(
          `UPDATE cash_accounts SET balance = balance - ? WHERE id=?`,
        ).run(input.amount, input.accountId)
        deps.db.prepare(
          `INSERT INTO cash_movements
            (id, account_id, amount, direction, category, reference_type, reference_id, photo_path, note, created_by, created_at)
           VALUES (?, ?, ?, 'out', 'gasto', 'expense', ?, ?, ?, ?, ?)`,
        ).run(
          randomUUID(),
          input.accountId,
          input.amount,
          id,
          input.photoPath ?? null,
          input.description,
          input.createdBy ?? null,
          new Date().toISOString(),
        )
      })
      tx()
      notify()
      return { ok: true as const, id }
    },

    transferCash(input: {
      fromAccountId: string
      toAccountId: string
      amount: number
      note?: string
      createdBy?: string
    }) {
      if (input.fromAccountId === input.toAccountId) {
        return { ok: false as const, error: 'same_account' }
      }
      const id = randomUUID()
      const tx = deps.db.transaction(() => {
        deps.db.prepare(
          `UPDATE cash_accounts SET balance = balance - ? WHERE id=?`,
        ).run(input.amount, input.fromAccountId)
        deps.db.prepare(
          `UPDATE cash_accounts SET balance = balance + ? WHERE id=?`,
        ).run(input.amount, input.toAccountId)
        deps.db.prepare(
          `INSERT INTO cash_movements
            (id, account_id, amount, direction, counterparty_account_id, category, reference_type, reference_id, note, created_by, created_at)
           VALUES (?, ?, ?, 'transfer', ?, 'traslado', 'transfer', ?, ?, ?, ?)`,
        ).run(
          id,
          input.fromAccountId,
          input.amount,
          input.toAccountId,
          id,
          input.note ?? 'Traslado entre cuentas',
          input.createdBy ?? null,
          new Date().toISOString(),
        )
      })
      tx()
      notify()
      return { ok: true as const, id }
    },

    applySalePaymentToCash(sale: RegisteredSale) {
      const map: Record<string, string> = {
        efectivo: 'acc-efectivo',
        sinpe: 'acc-sinpe',
        tarjeta: 'acc-tarjeta',
      }
      const accountId = map[sale.paymentMethod]
      if (!accountId) return
      const amount =
        sale.paymentMethod === 'efectivo'
          ? sale.total
          : sale.amountPaid
      deps.db.prepare(
        `UPDATE cash_accounts SET balance = balance + ? WHERE id=?`,
      ).run(amount, accountId)
      deps.db.prepare(
        `INSERT INTO cash_movements
          (id, account_id, amount, direction, category, reference_type, reference_id, note, created_at)
         VALUES (?, ?, ?, 'in', 'venta', 'sale', ?, ?, ?)`,
      ).run(
        randomUUID(),
        accountId,
        amount,
        sale.id,
        `Venta ${sale.paymentMethod}`,
        sale.createdAt,
      )
    },

    listShiftTemplates() {
      return deps.db
        .prepare(
          `SELECT id, name, sort_order as sortOrder, active FROM shift_templates ORDER BY sort_order`,
        )
        .all()
    },

    createShiftTemplate(name: string) {
      const count = (
        deps.db.prepare(`SELECT COUNT(*) as n FROM shift_templates WHERE active=1`).get() as {
          n: number
        }
      ).n
      if (count >= 3) return { ok: false as const, error: 'max_three' }
      const id = randomUUID()
      deps.db.prepare(
        `INSERT INTO shift_templates (id, name, sort_order, active) VALUES (?, ?, ?, 1)`,
      ).run(id, name, count + 1)
      notify()
      return { ok: true as const, id }
    },

    openShift(input: {
      templateId: string
      businessDate: string
      openedBy?: string
      userIds?: string[]
    }) {
      const open = deps.db
        .prepare(`SELECT id FROM shifts WHERE status='open' LIMIT 1`)
        .get() as { id: string } | undefined
      if (open) return { ok: false as const, error: 'already_open', shiftId: open.id }

      const prev = deps.db
        .prepare(
          `SELECT id, counted_cash, close_snapshot_json FROM shifts WHERE status='closed'
           ORDER BY closed_at DESC LIMIT 1`,
        )
        .get() as
        | { id: string; counted_cash: number | null; close_snapshot_json: string | null }
        | undefined

      const id = randomUUID()
      deps.db.prepare(
        `INSERT INTO shifts
          (id, template_id, business_date, status, opened_at, opened_by, previous_shift_id, expected_cash)
         VALUES (?, ?, ?, 'open', ?, ?, ?, ?)`,
      ).run(
        id,
        input.templateId,
        input.businessDate,
        new Date().toISOString(),
        input.openedBy ?? null,
        prev?.id ?? null,
        prev?.counted_cash ?? 0,
      )
      for (const uid of input.userIds ?? []) {
        deps.db.prepare(
          `INSERT INTO shift_assignments (shift_id, user_id) VALUES (?, ?)`,
        ).run(id, uid)
      }
      notify()
      return { ok: true as const, id, previousShiftId: prev?.id ?? null }
    },

    getOpenShift() {
      const shift = deps.db
        .prepare(
          `SELECT id, template_id as templateId, business_date as businessDate, status,
                  opened_at as openedAt, opened_by as openedBy, previous_shift_id as previousShiftId,
                  expected_cash as expectedCash, notes
           FROM shifts WHERE status='open' LIMIT 1`,
        )
        .get()
      return shift ?? null
    },

    closeShift(input: {
      shiftId: string
      closedBy?: string
      countedCash: number
      countedAccounts?: Record<string, number>
      countedInventory: Record<string, number>
      notes?: string
      physicalSheetPhoto?: string
    }) {
      const shift = deps.db
        .prepare(`SELECT * FROM shifts WHERE id=? AND status='open'`)
        .get(input.shiftId) as { id: string; opened_at: string } | undefined
      if (!shift) return { ok: false as const, error: 'not_open' }

      const salesInShift = deps.sales
        .list()
        .filter((s) => s.createdAt >= shift.opened_at)
      const productsNow = deps.products.listActive()
      const expectedInventory = Object.fromEntries(
        productsNow.map((p) => [p.id, p.physicalStock]),
      )
      const accountsNow = this.listAccounts() as {
        id: string
        name: string
        balance: number
      }[]
      const dayIds = ['acc-efectivo', 'acc-tarjeta', 'acc-sinpe'] as const
      const dayLabels: Record<string, string> = {
        'acc-efectivo': 'Efectivo',
        'acc-tarjeta': 'Tarjetas',
        'acc-sinpe': 'SINPE',
      }
      const expectedAccounts = Object.fromEntries(
        dayIds.map((id) => [
          id,
          accountsNow.find((a) => a.id === id)?.balance ?? 0,
        ]),
      ) as Record<string, number>
      const countedAccounts = {
        ...expectedAccounts,
        ...(input.countedAccounts ?? {}),
        'acc-efectivo':
          input.countedAccounts?.['acc-efectivo'] ?? input.countedCash,
      }
      const efectivo = expectedAccounts['acc-efectivo'] ?? 0
      const snapshot = {
        sales: salesInShift,
        products: productsNow,
        accounts: accountsNow,
        expectedAccounts,
        countedAccounts,
        merma: deps.db
          .prepare(
            `SELECT * FROM merma_records WHERE created_at >= ?`,
          )
          .all(shift.opened_at),
        exits: deps.db
          .prepare(`SELECT * FROM exit_records WHERE created_at >= ?`)
          .all(shift.opened_at),
      }

      deps.db.prepare(
        `UPDATE shifts SET status='closed', closed_at=?, closed_by=?, counted_cash=?,
          expected_cash=?, expected_inventory_json=?, counted_inventory_json=?,
          notes=?, physical_sheet_photo=?, close_snapshot_json=?
         WHERE id=?`,
      ).run(
        new Date().toISOString(),
        input.closedBy ?? null,
        countedAccounts['acc-efectivo'] ?? input.countedCash,
        efectivo,
        JSON.stringify(expectedInventory),
        JSON.stringify(input.countedInventory),
        input.notes ?? '',
        input.physicalSheetPhoto ?? null,
        JSON.stringify(snapshot),
        input.shiftId,
      )

      // Diferencias → propuesta automática si hay
      const diffs: { label: string; payload: unknown }[] = []
      for (const id of dayIds) {
        const expected = expectedAccounts[id] ?? 0
        const counted = countedAccounts[id] ?? expected
        if (Math.abs(counted - expected) > 0.009) {
          const labelName = dayLabels[id] ?? id
          diffs.push({
            label: `${labelName}: sistema ${expected} / contado ${counted}`,
            payload: {
              type: 'cash_diff',
              accountId: id,
              expected,
              counted,
            },
          })
        }
      }
      for (const [pid, counted] of Object.entries(input.countedInventory)) {
        const expected = expectedInventory[pid] ?? 0
        if (counted !== expected) {
          const name =
            productsNow.find((p) => p.id === pid)?.name ?? pid
          diffs.push({
            label: `${name}: esperado ${expected} / contado ${counted}`,
            payload: {
              type: 'stock_diff',
              productId: pid,
              expected,
              counted,
            },
          })
        }
      }
      if (diffs.length) {
        const proposalId = randomUUID()
        deps.db.prepare(
          `INSERT INTO proposals (id, type, status, title, payload_json, created_by, created_at)
           VALUES (?, 'shift_diff', 'open', ?, ?, ?, ?)`,
        ).run(
          proposalId,
          `Diferencias cierre ${input.shiftId.slice(0, 8)}`,
          JSON.stringify({ shiftId: input.shiftId }),
          input.closedBy ?? 'sistema',
          new Date().toISOString(),
        )
        for (const d of diffs) {
          deps.db.prepare(
            `INSERT INTO proposal_items (id, proposal_id, label, status, payload_json)
             VALUES (?, ?, ?, 'pending', ?)`,
          ).run(randomUUID(), proposalId, d.label, JSON.stringify(d.payload))
        }
      }

      notify()
      return { ok: true as const, differences: diffs.length }
    },

    listShifts() {
      return deps.db
        .prepare(
          `SELECT id, template_id as templateId, business_date as businessDate, status,
                  opened_at as openedAt, closed_at as closedAt, expected_cash as expectedCash,
                  counted_cash as countedCash, notes
           FROM shifts ORDER BY opened_at DESC`,
        )
        .all()
    },

    /** Resumen de un turno (abierto = en vivo; cerrado = snapshot de cierre). */
    getShiftSummary(shiftId: string) {
      const shift = deps.db
        .prepare(
          `SELECT id, template_id as templateId, business_date as businessDate, status,
                  opened_at as openedAt, closed_at as closedAt, opened_by as openedBy,
                  closed_by as closedBy, expected_cash as expectedCash,
                  counted_cash as countedCash, notes, close_snapshot_json as closeSnapshotJson,
                  expected_inventory_json as expectedInventoryJson,
                  counted_inventory_json as countedInventoryJson
           FROM shifts WHERE id=?`,
        )
        .get(shiftId) as
        | {
            id: string
            templateId: string
            businessDate: string
            status: string
            openedAt: string
            closedAt: string | null
            openedBy: string | null
            closedBy: string | null
            expectedCash: number | null
            countedCash: number | null
            notes: string
            closeSnapshotJson: string | null
            expectedInventoryJson: string | null
            countedInventoryJson: string | null
          }
        | undefined
      if (!shift) return { ok: false as const, error: 'not_found' }

      const openedAt = shift.openedAt
      const closedAt = shift.closedAt ?? undefined

      if (shift.status === 'closed' && shift.closeSnapshotJson) {
        let snapshot: {
          sales?: { total: number; paymentMethod: string }[]
          accounts?: { id: string; name: string; balance: number }[]
          expectedAccounts?: Record<string, number>
          countedAccounts?: Record<string, number>
          merma?: unknown[]
          exits?: unknown[]
        } = {}
        try {
          snapshot = JSON.parse(shift.closeSnapshotJson) as typeof snapshot
        } catch {
          snapshot = {}
        }
        const salesRows = snapshot.sales ?? []
        const byMethod: Record<string, number> = {}
        let salesTotal = 0
        for (const s of salesRows) {
          salesTotal += s.total
          byMethod[s.paymentMethod] =
            (byMethod[s.paymentMethod] ?? 0) + s.total
        }
        let expectedInventory: Record<string, number> = {}
        let countedInventory: Record<string, number> = {}
        try {
          expectedInventory = shift.expectedInventoryJson
            ? (JSON.parse(shift.expectedInventoryJson) as Record<string, number>)
            : {}
          countedInventory = shift.countedInventoryJson
            ? (JSON.parse(shift.countedInventoryJson) as Record<string, number>)
            : {}
        } catch {
          /* ignore */
        }
        return {
          ok: true as const,
          data: {
            shift: {
              id: shift.id,
              businessDate: shift.businessDate,
              status: shift.status,
              openedAt: shift.openedAt,
              closedAt: shift.closedAt,
              expectedCash: shift.expectedCash,
              countedCash: shift.countedCash,
              notes: shift.notes,
            },
            salesCount: salesRows.length,
            salesTotal,
            byMethod,
            accounts: snapshot.accounts ?? [],
            expectedAccounts: snapshot.expectedAccounts ?? {},
            countedAccounts: snapshot.countedAccounts ?? {},
            mermaCount: snapshot.merma?.length ?? 0,
            exitsCount: snapshot.exits?.length ?? 0,
            productionCount: (
              deps.db
                .prepare(
                  `SELECT COUNT(*) as n FROM production_sheets WHERE created_at >= ? AND created_at <= ?`,
                )
                .get(openedAt, closedAt ?? openedAt) as { n: number }
            ).n,
            expensesCount: (
              deps.db
                .prepare(
                  `SELECT COUNT(*) as n FROM expenses WHERE created_at >= ? AND created_at <= ?`,
                )
                .get(openedAt, closedAt ?? openedAt) as { n: number }
            ).n,
            expenses: this.listExpenses({
              sinceIso: openedAt,
              untilIso: closedAt ?? openedAt,
              limit: 100,
            }),
            expectedInventory,
            countedInventory,
            live: false,
          },
        }
      }

      const salesInShift = deps.sales
        .list()
        .filter((s) => s.createdAt >= openedAt)
      const byMethod: Record<string, number> = {}
      let salesTotal = 0
      for (const s of salesInShift) {
        salesTotal += s.total
        byMethod[s.paymentMethod] = (byMethod[s.paymentMethod] ?? 0) + s.total
      }
      return {
        ok: true as const,
        data: {
          shift: {
            id: shift.id,
            businessDate: shift.businessDate,
            status: shift.status,
            openedAt: shift.openedAt,
            closedAt: shift.closedAt,
            expectedCash: shift.expectedCash,
            countedCash: shift.countedCash,
            notes: shift.notes,
          },
          salesCount: salesInShift.length,
          salesTotal,
          byMethod,
          accounts: this.listAccounts(),
          expectedAccounts: {} as Record<string, number>,
          countedAccounts: {} as Record<string, number>,
          mermaCount: (
            deps.db
              .prepare(
                `SELECT COUNT(*) as n FROM merma_records WHERE created_at >= ?`,
              )
              .get(openedAt) as { n: number }
          ).n,
          exitsCount: (
            deps.db
              .prepare(
                `SELECT COUNT(*) as n FROM exit_records WHERE created_at >= ?`,
              )
              .get(openedAt) as { n: number }
          ).n,
          productionCount: (
            deps.db
              .prepare(
                `SELECT COUNT(*) as n FROM production_sheets WHERE created_at >= ?`,
              )
              .get(openedAt) as { n: number }
          ).n,
          expensesCount: (
            deps.db
              .prepare(
                `SELECT COUNT(*) as n FROM expenses WHERE created_at >= ?`,
              )
              .get(openedAt) as { n: number }
          ).n,
          expenses: this.listExpenses({ sinceIso: openedAt, limit: 100 }),
          expectedInventory: Object.fromEntries(
            deps.products.listActive().map((p) => [p.id, p.physicalStock]),
          ),
          countedInventory: {} as Record<string, number>,
          live: true,
        },
      }
    },

    createProposal(input: {
      type: string
      title: string
      payload: unknown
      items?: { label: string; payload?: unknown }[]
      createdBy: string
    }) {
      const id = randomUUID()
      deps.db.prepare(
        `INSERT INTO proposals (id, type, status, title, payload_json, created_by, created_at)
         VALUES (?, ?, 'open', ?, ?, ?, ?)`,
      ).run(
        id,
        input.type,
        input.title,
        JSON.stringify(input.payload),
        input.createdBy,
        new Date().toISOString(),
      )
      for (const item of input.items ?? [
        { label: input.title, payload: input.payload },
      ]) {
        deps.db.prepare(
          `INSERT INTO proposal_items (id, proposal_id, label, status, payload_json)
           VALUES (?, ?, ?, 'pending', ?)`,
        ).run(
          randomUUID(),
          id,
          item.label,
          JSON.stringify(item.payload ?? {}),
        )
      }
      notify()
      return { ok: true as const, id }
    },

    listProposals() {
      const rows = deps.db
        .prepare(
          `SELECT id, type, status, title, payload_json as payloadJson, created_by as createdBy,
                  created_at as createdAt, reviewed_by as reviewedBy, reviewed_at as reviewedAt,
                  review_note as reviewNote
           FROM proposals ORDER BY created_at DESC`,
        )
        .all() as Array<{ id: string; payloadJson: string }>
      return rows.map((r) => ({
        ...r,
        payload: JSON.parse(r.payloadJson),
        items: deps.db
          .prepare(
            `SELECT id, label, status, payload_json as payloadJson, applied
             FROM proposal_items WHERE proposal_id=?`,
          )
          .all(r.id)
          .map((i) => {
            const item = i as {
              id: string
              label: string
              status: string
              payloadJson: string
              applied: number
            }
            return {
              id: item.id,
              label: item.label,
              status: item.status,
              payload: JSON.parse(item.payloadJson),
              applied: item.applied === 1,
            }
          }),
      }))
    },

    reviewProposal(input: {
      proposalId: string
      reviewerId: string
      note?: string
      decisions: { itemId: string; status: 'approved' | 'rejected' | 'pending' }[]
    }) {
      const tx = deps.db.transaction(() => {
        for (const d of input.decisions) {
          deps.db.prepare(
            `UPDATE proposal_items SET status=? WHERE id=? AND proposal_id=?`,
          ).run(d.status, d.itemId, input.proposalId)

          if (d.status === 'approved') {
            const item = deps.db
              .prepare(`SELECT * FROM proposal_items WHERE id=?`)
              .get(d.itemId) as {
              payload_json: string
              applied: number
            }
            if (item && item.applied === 0) {
              const payload = JSON.parse(item.payload_json) as {
                type?: string
                productId?: string
                counted?: number
                expected?: number
                unitPrice?: number
                name?: string
              }
              if (payload.type === 'stock_diff' && payload.productId != null && payload.counted != null) {
                const current = deps.products.listActive().find((p) => p.id === payload.productId)
                if (current) {
                  const delta = payload.counted - current.physicalStock
                  deps.products.updateStock(payload.productId, payload.counted)
                  deps.db.prepare(
                    `INSERT INTO stock_movements
                      (id, created_at, product_id, quantity_delta, reason, reference_type, reference_id)
                     VALUES (?, ?, ?, ?, 'ajuste_aprobado', 'proposal_item', ?)`,
                  ).run(
                    randomUUID(),
                    new Date().toISOString(),
                    payload.productId,
                    delta,
                    d.itemId,
                  )
                }
              }
              if (payload.type === 'cash_diff' && payload.counted != null) {
                const current = (
                  deps.db
                    .prepare(`SELECT balance FROM cash_accounts WHERE id='acc-efectivo'`)
                    .get() as { balance: number }
                ).balance
                const delta = payload.counted - current
                deps.db.prepare(
                  `UPDATE cash_accounts SET balance=? WHERE id='acc-efectivo'`,
                ).run(payload.counted)
                deps.db.prepare(
                  `INSERT INTO cash_movements
                    (id, account_id, amount, direction, category, reference_type, reference_id, note, created_at)
                   VALUES (?, 'acc-efectivo', ?, 'transfer', 'ajuste_aprobado', 'proposal_item', ?, ?, ?)`,
                ).run(
                  randomUUID(),
                  Math.abs(delta),
                  d.itemId,
                  `Ajuste caja ${delta}`,
                  new Date().toISOString(),
                )
              }
              if (payload.type === 'price_change' && payload.productId && payload.unitPrice != null) {
                deps.db.prepare(`UPDATE products SET unit_price=?, updated_at=? WHERE id=?`).run(
                  payload.unitPrice,
                  new Date().toISOString(),
                  payload.productId,
                )
              }
              deps.db.prepare(`UPDATE proposal_items SET applied=1 WHERE id=?`).run(d.itemId)
            }
          }
        }

        const items = deps.db
          .prepare(`SELECT status FROM proposal_items WHERE proposal_id=?`)
          .all(input.proposalId) as { status: string }[]
        const approved = items.filter((i) => i.status === 'approved').length
        const rejected = items.filter((i) => i.status === 'rejected').length
        const pending = items.filter((i) => i.status === 'pending').length
        let status = 'open'
        if (pending === 0 && approved > 0 && rejected > 0) status = 'partial'
        else if (pending === 0 && approved === items.length) status = 'approved'
        else if (pending === 0 && rejected === items.length) status = 'rejected'
        else if (pending > 0 && (approved > 0 || rejected > 0)) status = 'partial'

        deps.db.prepare(
          `UPDATE proposals SET status=?, reviewed_by=?, reviewed_at=?, review_note=? WHERE id=?`,
        ).run(
          status,
          input.reviewerId,
          new Date().toISOString(),
          input.note ?? '',
          input.proposalId,
        )
      })
      tx()
      notify()
      return { ok: true as const }
    },

    requestProposalChanges(proposalId: string, reviewerId: string, note: string) {
      deps.db.prepare(
        `UPDATE proposals SET status='changes_requested', reviewed_by=?, reviewed_at=?, review_note=? WHERE id=?`,
      ).run(reviewerId, new Date().toISOString(), note, proposalId)
      notify()
      return { ok: true as const }
    },

    listPromos() {
      const promos = deps.db
        .prepare(
          `SELECT id, name, kind, price, active, photo_path as photoPath, created_at as createdAt
           FROM promos ORDER BY name`,
        )
        .all() as Array<{ id: string }>
      return promos.map((p) => ({
        ...p,
        components: deps.db
          .prepare(
            `SELECT product_id as productId, quantity, substitutable FROM promo_components WHERE promo_id=?`,
          )
          .all(p.id),
      }))
    },

    savePromo(input: {
      id?: string
      name: string
      kind: 'promo' | 'combo'
      price: number
      active?: boolean
      photoPath?: string | null
      components: { productId: string; quantity: number; substitutable?: boolean }[]
    }) {
      const id = input.id ?? randomUUID()
      const tx = deps.db.transaction(() => {
        const exists = deps.db.prepare(`SELECT id FROM promos WHERE id=?`).get(id)
        if (exists) {
          deps.db.prepare(
            `UPDATE promos SET name=?, kind=?, price=?, active=?, photo_path=COALESCE(?, photo_path) WHERE id=?`,
          ).run(
            input.name,
            input.kind,
            input.price,
            input.active === false ? 0 : 1,
            input.photoPath ?? null,
            id,
          )
          deps.db.prepare(`DELETE FROM promo_components WHERE promo_id=?`).run(id)
        } else {
          deps.db.prepare(
            `INSERT INTO promos (id, name, kind, price, active, created_at, photo_path) VALUES (?, ?, ?, ?, 1, ?, ?)`,
          ).run(
            id,
            input.name,
            input.kind,
            input.price,
            new Date().toISOString(),
            input.photoPath ?? null,
          )
        }
        const ins = deps.db.prepare(
          `INSERT INTO promo_components (promo_id, product_id, quantity, substitutable) VALUES (?, ?, ?, ?)`,
        )
        for (const c of input.components) {
          ins.run(id, c.productId, c.quantity, c.substitutable ? 1 : 0)
        }
      })
      tx()
      notify()
      return { ok: true as const, id }
    },

    sellCombo(input: {
      promoId: string
      substitutions?: Record<string, string>
      paymentMethod: 'efectivo' | 'sinpe' | 'tarjeta'
      amountPaid: number
    }) {
      const promo = deps.db
        .prepare(`SELECT * FROM promos WHERE id=? AND active=1`)
        .get(input.promoId) as
        | { id: string; name: string; price: number }
        | undefined
      if (!promo) return { ok: false as const, error: 'promo_not_found' }
      const components = deps.db
        .prepare(
          `SELECT product_id as productId, quantity, substitutable FROM promo_components WHERE promo_id=?`,
        )
        .all(input.promoId) as {
        productId: string
        quantity: number
        substitutable: number
      }[]

      const lines = components.map((c) => {
        const productId =
          c.substitutable && input.substitutions?.[c.productId]
            ? input.substitutions[c.productId]
            : c.productId
        return { productId, quantity: c.quantity }
      })

      // Reutiliza venta multi-línea del flujo base vía dependencia externa
      return { ok: true as const, promo, lines, price: promo.price }
    },

    registerExit(input: {
      productId: string
      quantity: number
      motive: string
      description?: string
      photoPath?: string
      audioPath?: string
      createdBy?: string
    }) {
      const list = deps.products.listActive()
      const result = registerMerma(list, input.productId, input.quantity)
      if (!result.ok) return result
      const product = list.find((p) => p.id === input.productId)!
      const id = randomUUID()
      const tx = deps.db.transaction(() => {
        const fresh = deps.products.listActive()
        const again = registerMerma(fresh, input.productId, input.quantity)
        if (!again.ok) throw Object.assign(new Error('fail'), { result: again })
        const next = again.nextProducts.find((p) => p.id === input.productId)!
        deps.products.updateStock(input.productId, next.physicalStock)
        deps.db.prepare(
          `INSERT INTO exit_records
            (id, created_at, product_id, product_name, quantity, motive, description, photo_path, audio_path, stock_before, stock_after, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          id,
          new Date().toISOString(),
          input.productId,
          product.name,
          input.quantity,
          input.motive,
          input.description ?? '',
          input.photoPath ?? null,
          input.audioPath ?? null,
          again.stockBefore,
          again.stockBefore - input.quantity,
          input.createdBy ?? null,
        )
        deps.db.prepare(
          `INSERT INTO stock_movements
            (id, created_at, product_id, quantity_delta, reason, reference_type, reference_id)
           VALUES (?, ?, ?, ?, ?, 'exit', ?)`,
        ).run(
          randomUUID(),
          new Date().toISOString(),
          input.productId,
          -input.quantity,
          input.motive,
          id,
        )
      })
      try {
        tx()
      } catch (err) {
        const fail = (err as { result?: { ok: false } })?.result
        if (fail) return fail
        throw err
      }
      notify()
      return { ok: true as const, id }
    },

    listExits() {
      return deps.db
        .prepare(
          `SELECT id, created_at as createdAt, product_id as productId, product_name as productName,
                  quantity, motive, description, photo_path as photoPath, review_status as reviewStatus
           FROM exit_records ORDER BY created_at DESC`,
        )
        .all()
    },

    saveInventoryCount(input: {
      scope?: string
      notes?: string
      createdBy?: string
      lines: { productId: string; expected: number; counted: number }[]
    }) {
      const id = randomUUID()
      deps.db.prepare(
        `INSERT INTO inventory_counts (id, created_at, created_by, scope, notes, lines_json)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        new Date().toISOString(),
        input.createdBy ?? null,
        input.scope ?? 'finished',
        input.notes ?? '',
        JSON.stringify(input.lines),
      )
      const diffs = input.lines.filter((l) => l.expected !== l.counted)
      if (diffs.length) {
        this.createProposal({
          type: 'inventory_count',
          title: `Conteo físico ${id.slice(0, 8)}`,
          payload: { countId: id },
          createdBy: input.createdBy ?? 'sistema',
          items: diffs.map((d) => ({
            label: `${d.productId}: ${d.expected} → ${d.counted}`,
            payload: {
              type: 'stock_diff',
              productId: d.productId,
              expected: d.expected,
              counted: d.counted,
            },
          })),
        })
      }
      notify()
      return { ok: true as const, id, differences: diffs.length }
    },

    dashboard(fromIso?: string, toIso?: string) {
      const salesAll = deps.sales.list()
      const filtered = salesAll.filter((s) => {
        if (fromIso && s.createdAt < fromIso) return false
        if (toIso && s.createdAt > toIso) return false
        return true
      })
      const salesTotal = filtered.reduce((s, x) => s + x.total, 0)
      const byMethod: Record<string, number> = {}
      for (const s of filtered) {
        byMethod[s.paymentMethod] = (byMethod[s.paymentMethod] ?? 0) + s.total
      }
      return {
        salesCount: filtered.length,
        salesTotal,
        byMethod,
        accounts: this.listAccounts(),
        products: deps.products.listActive(),
        openProposals: (
          deps.db.prepare(
            `SELECT COUNT(*) as n FROM proposals WHERE status IN ('open','partial','changes_requested')`,
          ).get() as { n: number }
        ).n,
        purchasesOpen: (
          deps.db.prepare(
            `SELECT COUNT(*) as n FROM purchases WHERE paid_amount < total`,
          ).get() as { n: number }
        ).n,
        mermaCount: (
          deps.db.prepare(`SELECT COUNT(*) as n FROM merma_records`).get() as {
            n: number
          }
        ).n,
        exitsCount: (
          deps.db.prepare(`SELECT COUNT(*) as n FROM exit_records`).get() as {
            n: number
          }
        ).n,
        productionCount: (
          deps.db.prepare(`SELECT COUNT(*) as n FROM production_sheets`).get() as {
            n: number
          }
        ).n,
        expensesCount: (
          deps.db.prepare(`SELECT COUNT(*) as n FROM expenses`).get() as {
            n: number
          }
        ).n,
        openShift: this.getOpenShift(),
        rawMaterials: this.listRawMaterials(),
      }
    },

    backupManual(note?: string) {
      return createBackup(deps.db, 'manual', note ?? '')
    },

    listBackups() {
      return listBackups(deps.db)
    },

    restoreBackup(backupPath: string) {
      createBackup(deps.db, 'manual', 'pre-restore')
      const prepared = prepareRestore(backupPath)
      if (!prepared.ok) return prepared
      deps.db.close()
      applyRestoreReplace(prepared.path)
      const next = reopenDb()
            notify()
      return { ok: true as const }
    },

    async getPrinterInfo() {
      return {
        settings: getPrinterSettings(deps.db),
        printers: await listWindowsPrinters(),
        hint: detectConnectionHint(),
      }
    },

    savePrinter(settings: { printerName: string; paperChars: number }) {
      savePrinterSettings(deps.db, settings)
      return { ok: true as const }
    },

    getBakeryPublicInfo() {
      return getBakeryPublic(deps.db)
    },

    saveBakeryPublicInfo(input: Partial<BakeryPublicInfo>) {
      const bakery = saveBakeryPublic(deps.db, input)
      return { ok: true as const, bakery }
    },

    async printSale(saleId: string) {
      const sale = deps.sales.list().find((s) => s.id === saleId)
      if (!sale) return { ok: false as const, error: 'sale_not_found' }
      const settings = getPrinterSettings(deps.db)
      const text = formatSaleTicket(sale, settings.paperChars)
      return printText(deps.db, text, saleId)
    },

    stockMovements(productId?: string) {
      if (productId) {
        return deps.db
          .prepare(
            `SELECT id, created_at as createdAt, product_id as productId, quantity_delta as quantityDelta,
                    reason, reference_type as referenceType, reference_id as referenceId
             FROM stock_movements WHERE product_id=? ORDER BY created_at DESC`,
          )
          .all(productId)
      }
      return deps.db
        .prepare(
          `SELECT id, created_at as createdAt, product_id as productId, quantity_delta as quantityDelta,
                  reason, reference_type as referenceType, reference_id as referenceId
           FROM stock_movements ORDER BY created_at DESC LIMIT 200`,
        )
        .all()
    },
  }
}

export type MvpFlujo = ReturnType<typeof createMvpFlujo>
