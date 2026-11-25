import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
/** Repo root when running from server/src; portable root when bundled next to server. */
export const APP_ROOT = path.resolve(__dirname, '../../')

const DB_NAME = 'panaderia-lela.sqlite'

/** Carpeta legacy junto al código (versiones viejas / ZIP). */
export const LEGACY_DATA_DIR = path.join(APP_ROOT, 'data')

/**
 * Datos durables fuera del checkout de git.
 * Así `Iniciar.bat` / git pull nunca pueden borrar ventas ni catálogo.
 * Override: LELA_DATA_DIR
 */
export const DURABLE_DATA_DIR = path.join(
  process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
  'PanaderiaLela',
  'data',
)

function dbFile(dir: string): string {
  return path.join(dir, DB_NAME)
}

function dbSize(dir: string): number {
  try {
    return fs.statSync(dbFile(dir)).size
  } catch {
    return 0
  }
}

function copyDataTree(fromDir: string, toDir: string): void {
  fs.mkdirSync(toDir, { recursive: true })
  fs.mkdirSync(path.join(toDir, 'backups'), { recursive: true })
  fs.mkdirSync(path.join(toDir, 'uploads'), { recursive: true })
  for (const name of fs.readdirSync(fromDir)) {
    if (name === '.' || name === '..') continue
    const src = path.join(fromDir, name)
    const dest = path.join(toDir, name)
    const st = fs.statSync(src)
    if (st.isDirectory()) {
      fs.cpSync(src, dest, { recursive: true, force: true })
    } else {
      fs.copyFileSync(src, dest)
    }
  }
}

function newestSafetyDb(): string | null {
  const safetyRoot = path.join(
    process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
    'PanaderiaLela',
    'safety',
  )
  if (!fs.existsSync(safetyRoot)) return null
  let best: { file: string; size: number; mtime: number } | null = null
  for (const name of fs.readdirSync(safetyRoot)) {
    const candidate = path.join(safetyRoot, name, DB_NAME)
    try {
      const st = fs.statSync(candidate)
      if (!best || st.size > best.size || (st.size === best.size && st.mtimeMs > best.mtime)) {
        best = { file: candidate, size: st.size, mtime: st.mtimeMs }
      }
    } catch {
      /* skip */
    }
  }
  return best && best.size > 0 ? best.file : null
}

/**
 * Elige carpeta de datos y migra/recupera si hace falta.
 * Prioridad: LELA_DATA_DIR → AppData (migra desde ./data o safety si es más completa).
 */
function resolveDataDir(): string {
  if (process.env.LELA_DATA_DIR) {
    return path.resolve(process.env.LELA_DATA_DIR)
  }

  const durable = DURABLE_DATA_DIR
  const legacy = LEGACY_DATA_DIR
  let durableSize = dbSize(durable)
  const legacySize = dbSize(legacy)

  fs.mkdirSync(durable, { recursive: true })

  if (legacySize > 0 && durableSize === 0) {
    copyDataTree(legacy, durable)
    console.log(`  Datos migrados: ${legacy} → ${durable}`)
    durableSize = dbSize(durable)
  } else if (legacySize > durableSize && legacySize > 0) {
    if (durableSize > 0) {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-')
      const safety = path.join(durable, 'backups', `pre-migrate-${stamp}`)
      fs.mkdirSync(safety, { recursive: true })
      try {
        fs.copyFileSync(dbFile(durable), path.join(safety, DB_NAME))
      } catch {
        /* ignore */
      }
    }
    copyDataTree(legacy, durable)
    console.log(
      `  Datos recuperados desde carpeta del programa (${legacySize} B → AppData)`,
    )
    durableSize = dbSize(durable)
  }

  if (durableSize === 0) {
    const safetyDb = newestSafetyDb()
    if (safetyDb) {
      fs.copyFileSync(safetyDb, dbFile(durable))
      const safetyDir = path.dirname(safetyDb)
      for (const side of [`${DB_NAME}-wal`, `${DB_NAME}-shm`]) {
        const sidePath = path.join(safetyDir, side)
        if (fs.existsSync(sidePath)) {
          fs.copyFileSync(sidePath, path.join(durable, side))
        }
      }
      console.log(`  Datos recuperados desde respaldo de seguridad: ${safetyDb}`)
    }
  }

  return durable
}

export const DATA_DIR = resolveDataDir()
export const DB_PATH = path.join(DATA_DIR, DB_NAME)
export const BACKUP_DIR = path.join(DATA_DIR, 'backups')
export const LEGACY_IMPORT_FLAG = path.join(DATA_DIR, 'legacy-imported.json')

export const PORT = Number(process.env.PORT ?? 3000)
export const HOST = process.env.HOST ?? '0.0.0.0'

export const WEB_DIST = path.join(APP_ROOT, 'dist')

export function ensureDataDirs(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.mkdirSync(BACKUP_DIR, { recursive: true })
  fs.mkdirSync(path.join(DATA_DIR, 'uploads'), { recursive: true })
}

export function getLanAddresses(): string[] {
  const nets = os.networkInterfaces()
  const addresses: string[] = []
  for (const entries of Object.values(nets)) {
    if (!entries) continue
    for (const entry of entries) {
      if (entry.family === 'IPv4' && !entry.internal) {
        addresses.push(entry.address)
      }
    }
  }
  return addresses
}
