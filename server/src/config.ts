import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
/** Repo root when running from server/src; portable root when bundled next to server. */
export const APP_ROOT = path.resolve(__dirname, '../../')

/** Persistent data lives next to the app (never in OS temp). */
export const DATA_DIR = process.env.LELA_DATA_DIR
  ? path.resolve(process.env.LELA_DATA_DIR)
  : path.join(APP_ROOT, 'data')
export const DB_PATH = path.join(DATA_DIR, 'panaderia-lela.sqlite')
export const BACKUP_DIR = path.join(DATA_DIR, 'backups')
export const LEGACY_IMPORT_FLAG = path.join(DATA_DIR, 'legacy-imported.json')

export const PORT = Number(process.env.PORT ?? 3000)
export const HOST = process.env.HOST ?? '0.0.0.0'

export const WEB_DIST = path.join(APP_ROOT, 'dist')

export function ensureDataDirs(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.mkdirSync(BACKUP_DIR, { recursive: true })
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
