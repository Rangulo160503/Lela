/**
 * Si la BD local tiene menos productos que data/bundled/, restaura el bundle.
 * Además, fusiona promos del bundle que falten en local (sin pisar ventas).
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

/** Inserta promos del bundle que no existan en local (por id o por nombre). */
function mergeMissingPromos(bundleFile, localFile) {
  if (!fs.existsSync(bundleFile) || !fs.existsSync(localFile)) return 0
  const src = new Database(bundleFile, { readonly: true })
  const dst = new Database(localFile)
  let added = 0
  try {
    const promos = src
      .prepare(
        `SELECT id, name, kind, price, active, created_at, photo_path
         FROM promos WHERE active = 1`,
      )
      .all()
    const insertPromo = dst.prepare(
      `INSERT OR IGNORE INTO promos (id, name, kind, price, active, created_at, photo_path)
       VALUES (@id, @name, @kind, @price, @active, @created_at, @photo_path)`,
    )
    const hasByName = dst.prepare(
      `SELECT id FROM promos WHERE lower(name)=lower(?) AND active=1 LIMIT 1`,
    )
    const insertComp = dst.prepare(
      `INSERT INTO promo_components (promo_id, product_id, quantity, substitutable)
       VALUES (?, ?, ?, ?)`,
    )
    const compsFor = src.prepare(
      `SELECT product_id, quantity, substitutable FROM promo_components WHERE promo_id=?`,
    )
    const productExists = dst.prepare(
      `SELECT id FROM products WHERE id=? LIMIT 1`,
    )

    const tx = dst.transaction(() => {
      for (const p of promos) {
        if (hasByName.get(p.name)) continue
        const info = insertPromo.run({
          id: p.id,
          name: p.name,
          kind: p.kind,
          price: p.price,
          active: p.active,
          created_at: p.created_at,
          photo_path: p.photo_path ?? null,
        })
        if (!info.changes) continue
        const comps = compsFor.all(p.id)
        for (const c of comps) {
          if (!productExists.get(c.product_id)) continue
          insertComp.run(
            p.id,
            c.product_id,
            c.quantity,
            c.substitutable ? 1 : 0,
          )
        }
        added++
      }
    })
    tx()
  } finally {
    src.close()
    try {
      dst.pragma('wal_checkpoint(TRUNCATE)')
    } catch {
      /* ignore */
    }
    dst.close()
  }
  return added
}

/** Reactiva productos clave del bundle si local los tiene inactivos. */
function ensureKeyProductsActive(bundleFile, localFile) {
  if (!fs.existsSync(bundleFile) || !fs.existsSync(localFile)) return 0
  const src = new Database(bundleFile, { readonly: true })
  const dst = new Database(localFile)
  let n = 0
  try {
    const keys = src
      .prepare(
        `SELECT id, name FROM products
         WHERE active=1 AND (
           lower(name) LIKE '%manita%' OR lower(name) LIKE '%bonete%'
         )`,
      )
      .all()
    const reactivate = dst.prepare(
      `UPDATE products SET active=1 WHERE id=? AND active=0`,
    )
    for (const k of keys) {
      const info = reactivate.run(k.id)
      if (info.changes) n++
    }
  } finally {
    src.close()
    dst.close()
  }
  return n
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
const durableFile = path.join(durableDir, DB_NAME)
const legacyFile = path.join(legacyDir, DB_NAME)
const durableN = productCount(durableFile)
const legacyN = productCount(legacyFile)
const localN = Math.max(durableN, legacyN)

console.log(
  `  Bundle: ${bundledN} productos · local: ${localN} (AppData ${durableN}, carpeta ${legacyN})`,
)

if (bundledN <= 0) {
  console.log('  Bundle vacío — no se restaura.')
  process.exit(0)
}

if (localN < bundledN) {
  console.log('  Restaurando catálogo/datos desde data/bundled/ …')
  copyDb(BUNDLE, durableDir)
  copyDb(BUNDLE, legacyDir)
  console.log(`  Restaurado: ${bundledN} productos activos.`)
} else {
  console.log('  Datos locales OK (igual o más completos). No se pisa catálogo.')
}

for (const file of [durableFile, legacyFile]) {
  if (!fs.existsSync(file)) continue
  const added = mergeMissingPromos(BUNDLE, file)
  const reactivated = ensureKeyProductsActive(BUNDLE, file)
  if (added || reactivated) {
    console.log(
      `  Merge en ${file}: +${added} promo(s), reactivados ${reactivated}`,
    )
  }
}

console.log('  ensure-bundled-data listo.')
