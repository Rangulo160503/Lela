import fs from 'node:fs'
import path from 'node:path'
import cors from 'cors'
import express from 'express'
import { createRouter } from './api/createRouter.js'
import {
  HOST,
  PORT,
  WEB_DIST,
  DATA_DIR,
  getLanAddresses,
  ensureDataDirs,
} from './config.js'
import { closeDatabase, openDatabase, type AppDatabase } from './da/db.js'
import { createMermaRepo } from './da/repositories/mermaRepo.js'
import { createMovementsRepo } from './da/repositories/movementsRepo.js'
import { createProductionRepo } from './da/repositories/productionRepo.js'
import { createProductsRepo } from './da/repositories/productsRepo.js'
import { createSalesRepo } from './da/repositories/salesRepo.js'
import { createAppFlujo } from './flujo/appFlujo.js'
import { createMvpFlujo } from './flujo/mvpFlujo.js'
import { seedMvp } from './servicios/seedMvp.js'
import { maybeAutoBackup } from './servicios/backup.js'

ensureDataDirs()
fs.mkdirSync(path.join(DATA_DIR, 'uploads'), { recursive: true })

type Repos = {
  db: AppDatabase
  products: ReturnType<typeof createProductsRepo>
  sales: ReturnType<typeof createSalesRepo>
  production: ReturnType<typeof createProductionRepo>
  merma: ReturnType<typeof createMermaRepo>
  movements: ReturnType<typeof createMovementsRepo>
}

function bootDb(): Repos {
  closeDatabase()
  const database = openDatabase()
  const productsRepo = createProductsRepo(database)
  seedMvp(database, productsRepo)
  maybeAutoBackup(database)
  return {
    db: database,
    products: productsRepo,
    sales: createSalesRepo(database),
    production: createProductionRepo(database),
    merma: createMermaRepo(database),
    movements: createMovementsRepo(database),
  }
}

const repos: Repos = bootDb()

const deps = {
  get db() {
    return repos.db
  },
  get products() {
    return repos.products
  },
  get sales() {
    return repos.sales
  },
  get production() {
    return repos.production
  },
  get merma() {
    return repos.merma
  },
  get movements() {
    return repos.movements
  },
}

const flujo = createAppFlujo(deps)

const mvp = createMvpFlujo({
  get db() {
    return repos.db
  },
  get products() {
    return repos.products
  },
  get sales() {
    return repos.sales
  },
  reopenDb: () => {
    const next = bootDb()
    repos.db = next.db
    repos.products = next.products
    repos.sales = next.sales
    repos.production = next.production
    repos.merma = next.merma
    repos.movements = next.movements
    return repos.db
  },
})

const app = express()
app.use(cors())
app.use(express.json({ limit: '12mb' }))
app.use('/uploads', express.static(path.join(DATA_DIR, 'uploads')))
app.use('/api', createRouter(flujo, mvp))

if (fs.existsSync(WEB_DIST)) {
  app.use(express.static(WEB_DIST))
  app.get(/^(?!\/api)(?!\/uploads).*/, (_req, res) => {
    res.sendFile(path.join(WEB_DIST, 'index.html'))
  })
}

const server = app.listen(PORT, HOST, () => {
  const lans = getLanAddresses()
  console.log('')
  console.log('  Panadería Lela — servidor local')
  console.log(`  Local:   http://127.0.0.1:${PORT}`)
  for (const ip of lans) {
    console.log(`  Red:     http://${ip}:${PORT}`)
  }
  console.log('  Usuarios: admin / 1234   |   empleado / 0000')
  console.log('')
})

function shutdown(): void {
  server.close(() => {
    closeDatabase()
    process.exit(0)
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
