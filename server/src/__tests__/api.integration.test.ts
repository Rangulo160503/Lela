import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import express from 'express'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lela-test-'))
process.env.LELA_DATA_DIR = tmp

describe('API integración', () => {
  let server: ReturnType<express.Express['listen']>
  let base = ''
  let token = ''
  let closeDatabase: () => void

  beforeAll(async () => {
    const dbMod = await import('../da/db.js')
    const { createProductsRepo } = await import('../da/repositories/productsRepo.js')
    const { createSalesRepo } = await import('../da/repositories/salesRepo.js')
    const { createProductionRepo } = await import(
      '../da/repositories/productionRepo.js'
    )
    const { createMermaRepo } = await import('../da/repositories/mermaRepo.js')
    const { createMovementsRepo } = await import(
      '../da/repositories/movementsRepo.js'
    )
    const { createAppFlujo } = await import('../flujo/appFlujo.js')
    const { createMvpFlujo } = await import('../flujo/mvpFlujo.js')
    const { seedMvp } = await import('../servicios/seedMvp.js')
    const { createRouter } = await import('../api/createRouter.js')

    closeDatabase = dbMod.closeDatabase
    dbMod.closeDatabase()
    const db = dbMod.openDatabase()
    const products = createProductsRepo(db)
    seedMvp(db, products)
    const sales = createSalesRepo(db)
    const production = createProductionRepo(db)
    const merma = createMermaRepo(db)
    const movements = createMovementsRepo(db)
    const deps = { db, products, sales, production, merma, movements }
    const flujo = createAppFlujo(deps)
    const mvp = createMvpFlujo({
      db,
      products,
      sales,
      reopenDb: () => db,
    })
    const app = express()
    app.use(express.json())
    app.use('/api', createRouter(flujo, mvp))
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => resolve())
    })
    const addr = server.address()
    if (!addr || typeof addr === 'string') throw new Error('no port')
    base = `http://127.0.0.1:${addr.port}/api`
  })

  afterAll(() => {
    if (server) server.close()
    closeDatabase?.()
    try {
      fs.rmSync(tmp, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  it('login + venta + stock + permiso denegado', async () => {
    const login = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', pin: '1234' }),
    }).then((r) => r.json())
    expect(login.ok).toBe(true)
    token = login.token

    const before = await fetch(`${base}/snapshot`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json())
    const panBefore = before.products.find(
      (p: { id: string }) => p.id === 'mock-pan',
    ).physicalStock

    const sale = await fetch(`${base}/sales`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        lines: [{ productId: 'mock-pan', quantity: 2 }],
        paymentMethod: 'efectivo',
        amountPaid: 50,
      }),
    }).then((r) => r.json())
    expect(sale.ok).toBe(true)
    expect(sale.sale.change).toBe(20)

    const after = await fetch(`${base}/snapshot`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json())
    const panAfter = after.products.find(
      (p: { id: string }) => p.id === 'mock-pan',
    ).physicalStock
    expect(panAfter).toBe(panBefore - 2)

    const denied = await fetch(`${base}/dashboard`)
    expect(denied.status).toBe(401)
  })
})
