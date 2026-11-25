/**
 * Si la BD local tiene menos productos que data/bundled/, restaura el bundle.
 * Usado por Iniciar.bat tras git pull (PC de la panadería).
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const BUNDLE = path.join(ROOT, 'data', 'bundled', 'panaderia-lela.sqlite')
const DB_NAME = 'panaderia-lela.sqlite'

function productCount(file) {
  if (!fs.existsSync(file)) return 0
  try {
    const db = new Database(file, { readonly: true })
    try {
      db.pragma('wal_checkpoint(PASSIVE)')
    } catch {
      /* ignore */
    }
    const n = (
      db.prepare(`SELECT COUNT(*) as n FROM products WHERE active = 1`).get()
    )?.n
    db.close()
    return Number(n) || 0
  } catch {
    return 0
  }
}

function copyDb(fromFile, toDir) {
  fs.mkdirSync(toDir, { recursive: true })
  fs.mkdirSync(path.join(toDir, 'backups'), { recursive: true })
  const dest = path.join(toDir, DB_NAME)
  if (fs.existsSync(dest)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    fs.copyFileSync(
      dest,
      path.join(toDir, 'backups', `pre-bundle-restore-${stamp}.sqlite`),
    )
  }
  fs.copyFileSync(fromFile, dest)
  for (const side of [`${DB_NAME}-wal`, `${DB_NAME}-shm`]) {
    const p = path.join(toDir, side)
    if (fs.existsSync(p)) fs.unlinkSync(p)
  }
}

if (!fs.existsSync(BUNDLE)) {
  console.log('  (sin data/bundled — nada que restaurar)')
  process.exit(0)
}

const bundledN = productCount(BUNDLE)
const durableDir = path.join(
  process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
  'PanaderiaLela',
  'data',
)
const legacyDir = path.join(ROOT, 'data')
const durableN = productCount(path.join(durableDir, DB_NAME))
const legacyN = productCount(path.join(legacyDir, DB_NAME))
const localN = Math.max(durableN, legacyN)

console.log(
  `  Bundle: ${bundledN} productos · local: ${localN} (AppData ${durableN}, carpeta ${legacyN})`,
)

if (bundledN <= 0) {
  console.log('  Bundle vacío — no se restaura.')
  process.exit(0)
}

if (localN >= bundledN) {
  console.log('  Datos locales OK (igual o más completos). No se pisa.')
  process.exit(0)
}

console.log('  Restaurando catálogo/datos desde data/bundled/ …')
copyDb(BUNDLE, durableDir)
copyDb(BUNDLE, legacyDir)
console.log(`  Restaurado: ${bundledN} productos activos.`)
