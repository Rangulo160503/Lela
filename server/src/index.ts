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
 * UI principal = React (`dist/`) — la que el cliente ya daba por buena.
 * `lite/` solo para iPad 4 / iOS 9 (o ruta explícita `/lite`).
 */
const DIST_DIR = path.join(APP_ROOT, 'dist')
const PUBLIC_DIR = path.join(APP_ROOT, 'public')
const LITE_IMAGES = path.join(LITE_DIR, 'images')

if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
  console.error('Falta dist/index.html. Ejecutá: npm run build:web')
  process.exit(1)
}
if (!fs.existsSync(path.join(LITE_DIR, 'index.html'))) {
  console.error('Falta lite/index.html (fallback iOS 9).')
  process.exit(1)
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

/** iPad (cualquier iOS) + iPhone/iPod iOS 9 → lite. React no corre bien en Safari viejo. */
function wantsLite(req: express.Request): boolean {
  if (req.path === '/lite' || req.path.startsWith('/lite/')) return true
  const ua = String(req.headers['user-agent'] || '')
  if (/iPad/i.test(ua)) return true
  if (/(iPhone|iPod).*OS 9[_.]/i.test(ua)) return true
  if (/(iPhone|iPod)/i.test(ua) && /Version\/9\./i.test(ua)) return true
  return false
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

/** HTML ANTES que static(dist): si no, dist/index.html gana y el iPad recibe React muerto. */
app.get(['/', '/index.html'], (req, res) => {
  res.setHeader('Vary', 'User-Agent')
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
  if (wantsLite(req)) {
    res.sendFile(path.join(LITE_DIR, 'index.html'))
    return
  }
  res.sendFile(path.join(DIST_DIR, 'index.html'))
})

/** Assets React sin index automático */
app.use(express.static(DIST_DIR, { ...staticApp, index: false }))

/** SPA fallback (React Router) */
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next()
  if (req.path.startsWith('/api')) return next()
  if (req.path.startsWith('/uploads')) return next()
  if (req.path.startsWith('/images')) return next()
  if (req.path.startsWith('/fonts')) return next()
  if (req.path.startsWith('/lite')) return next()
  if (/\.[a-z0-9]+$/i.test(req.path)) return next()
  res.setHeader('Vary', 'User-Agent')
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
  if (wantsLite(req)) {
    res.sendFile(path.join(LITE_DIR, 'index.html'))
    return
  }
  res.sendFile(path.join(DIST_DIR, 'index.html'))
})

const server = app.listen(PORT, HOST, () => {
  const lans = getLanAddresses()
  console.log('')
  console.log('  Panadería Lela — servidor local')
  console.log(`  Abrir:   http://127.0.0.1:${PORT}/   (UI React)`)
  console.log(`  iPad 4:  http://127.0.0.1:${PORT}/lite  (o auto por iOS 9)`)
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
