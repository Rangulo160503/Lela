import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { DB_PATH, ensureDataDirs } from '../config.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = path.join(__dirname, 'migrations')

export type AppDatabase = Database.Database

let dbInstance: AppDatabase | null = null

export function getDb(): AppDatabase {
  if (!dbInstance) {
    throw new Error('Base de datos no inicializada')
  }
  return dbInstance
}

export function openDatabase(): AppDatabase {
  ensureDataDirs()
  const db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')
  runMigrations(db)
  dbInstance = db
  return db
}

function runMigrations(db: AppDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `)

  const applied = new Set(
    db
      .prepare('SELECT id FROM schema_migrations')
      .all()
      .map((row) => (row as { id: string }).id),
  )

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort()

  const insert = db.prepare(
    'INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)',
  )

  for (const file of files) {
    if (applied.has(file)) continue
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')
    const apply = db.transaction(() => {
      db.exec(sql)
      insert.run(file, new Date().toISOString())
    })
    apply()
  }
}

export function closeDatabase(): void {
  if (!dbInstance) return
  try {
    dbInstance.close()
  } catch {
    // already closed
  }
  dbInstance = null
}
