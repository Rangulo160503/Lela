import fs from 'node:fs'
import path from 'node:path'
import { BACKUP_DIR, DB_PATH, ensureDataDirs } from '../config.js'
import type { AppDatabase } from '../da/db.js'

export function createBackup(
  db: AppDatabase,
  kind: 'manual' | 'auto' = 'manual',
  note = '',
): { ok: true; path: string; id: string } {
  ensureDataDirs()
  db.pragma('wal_checkpoint(FULL)')
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const fileName = `backup-${stamp}.sqlite`
  const dest = path.join(BACKUP_DIR, fileName)
  fs.copyFileSync(DB_PATH, dest)
  const id = `bk-${stamp}`
  db.prepare(
    `INSERT INTO backups_log (id, created_at, path, kind, note) VALUES (?, ?, ?, ?, ?)`,
  ).run(id, new Date().toISOString(), dest, kind, note)
  return { ok: true, path: dest, id }
}

export function listBackups(db: AppDatabase) {
  return db
    .prepare(
      `SELECT id, created_at as createdAt, path, kind, note
       FROM backups_log ORDER BY created_at DESC`,
    )
    .all()
}

/** Restaura un respaldo. El llamador debe cerrar y reabrir la BD. */
export function prepareRestore(
  backupPath: string,
): { ok: true; path: string } | { ok: false; error: string } {
  if (!fs.existsSync(backupPath)) {
    return { ok: false, error: 'El archivo de respaldo no existe.' }
  }
  const staging = path.join(BACKUP_DIR, `restore-staging-${Date.now()}.sqlite`)
  fs.copyFileSync(backupPath, staging)
  return { ok: true, path: staging }
}

export function applyRestoreReplace(stagingPath: string): void {
  ensureDataDirs()
  const safety = path.join(
    BACKUP_DIR,
    `pre-restore-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`,
  )
  if (fs.existsSync(DB_PATH)) {
    fs.copyFileSync(DB_PATH, safety)
  }
  fs.copyFileSync(stagingPath, DB_PATH)
  try {
    fs.unlinkSync(stagingPath)
  } catch {
    // ignore
  }
}

export function maybeAutoBackup(db: AppDatabase): void {
  ensureDataDirs()
  try {
    const last = db
      .prepare(
        `SELECT created_at as createdAt FROM backups_log
         WHERE kind = 'auto' ORDER BY created_at DESC LIMIT 1`,
      )
      .get() as { createdAt: string } | undefined
    if (last && Date.now() - Date.parse(last.createdAt) < 1000 * 60 * 60 * 6) {
      return
    }
    createBackup(db, 'auto', 'Respaldo automático')
  } catch {
    // ignore
  }
}
