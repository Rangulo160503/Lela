import fs from 'node:fs'
import path from 'node:path'
import compression from 'compression'
import cors from 'cors'
import express from 'express'
import { createRouter } from './api/createRouter.js'
import {
  APP_ROOT,
  HOST,
  PORT,
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

const LITE_DIR = path.join(APP_ROOT, 'lite')

const app = express()
app.use(cors())
/** Gzip solo estáticos — no API (Safari iOS 9 + túnel a veces cuelga el XHR). */
app.use(
  compression({
    threshold: 512,
    filter(req, res) {
      if (req.path.startsWith('/api')) return false
      return compression.filter(req, res)
    },
  }),
)
app.use(express.json({ limit: '12mb' }))
app.use('/uploads', express.static(path.join(DATA_DIR, 'uploads'), { maxAge: '1h' }))
app.use('/api', createRouter(flujo, mvp))

/**
 * UI principal = `lite/` (Gastos foto/manual, Cierre, Saldos, iPad 4).
 * React (`dist/`) queda en `/react` o `?ui=react` por si hace falta.
 */
const DIST_DIR = path.join(APP_ROOT, 'dist')
const PUBLIC_DIR = path.join(APP_ROOT, 'public')
const LITE_IMAGES = path.join(LITE_DIR, 'images')

if (!fs.existsSync(path.join(LITE_DIR, 'index.html'))) {
  console.error('Falta lite/index.html (UI principal).')
  process.exit(1)
}
if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
  console.warn('AVISO: falta dist/index.html (UI React opcional en /react).')
}

function staticOpts(longCache: boolean) {
  return {
    maxAge: longCache ? '7d' : 0,
    etag: true,
    lastModified: true,
    setHeaders(res: express.Response, filePath: string) {
      if (/\.(html?|js|css)$/i.test(filePath)) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
        res.setHeader('Pragma', 'no-cache')
        res.setHeader('Expires', '0')
      }
    },
  }
}
const staticLong = staticOpts(true)
const staticApp = staticOpts(false)

/** lite por defecto; React solo con /react o ?ui=react */
function wantsLite(req: express.Request): boolean {
  if (req.path === '/react' || req.path.startsWith('/react/')) return false
  if (String(req.query.ui || '') === 'react') return false
  return true
}

if (fs.existsSync(LITE_IMAGES)) {
  app.use('/images', express.static(LITE_IMAGES, staticLong))
}
if (fs.existsSync(PUBLIC_DIR)) {
  app.use('/fonts', express.static(path.join(PUBLIC_DIR, 'fonts'), staticLong))
  app.use('/images', express.static(path.join(PUBLIC_DIR, 'images'), staticLong))
  app.use(express.static(PUBLIC_DIR, staticLong))
}

app.use('/lite', express.static(LITE_DIR, { ...staticApp, index: 'index.html' }))

app.get(['/', '/index.html', '/lite', '/lite/'], (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
  if (wantsLite(req)) {
    res.sendFile(path.join(LITE_DIR, 'index.html'))
    return
  }
  res.sendFile(path.join(DIST_DIR, 'index.html'))
})

app.get(['/react', '/react/', '/react/index.html'], (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
  if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
    res.status(404).send('UI React no construida (npm run build:web).')
    return
  }
  res.sendFile(path.join(DIST_DIR, 'index.html'))
})

/** Assets React (JS/CSS hasheados) sin index automático */
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR, { ...staticApp, index: false }))
}

/** SPA fallback */
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next()
  if (req.path.startsWith('/api')) return next()
  if (req.path.startsWith('/uploads')) return next()
  if (req.path.startsWith('/images')) return next()
  if (req.path.startsWith('/fonts')) return next()
  if (req.path.startsWith('/lite')) return next()
  if (/\.[a-z0-9]+$/i.test(req.path)) return next()
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
  if (wantsLite(req)) {
    res.sendFile(path.join(LITE_DIR, 'index.html'))
    return
  }
  if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
    res.status(404).send('UI no disponible.')
    return
  }
  res.sendFile(path.join(DIST_DIR, 'index.html'))
})

const server = app.listen(PORT, HOST, () => {
  const lans = getLanAddresses()
  console.log('')
  console.log('  Panadería Lela — servidor local')
  console.log(`  Abrir:   http://127.0.0.1:${PORT}/        (UI lite: Gastos, Cierre, …)`)
  console.log(`  React:   http://127.0.0.1:${PORT}/react   (opcional)`)
  for (const ip of lans) {
    console.log(`  Red:     http://${ip}:${PORT}/`)
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
