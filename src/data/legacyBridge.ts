const LEGACY_KEY = 'panaderia-lela-store-v4'
const LEGACY_KEYS = [
  LEGACY_KEY,
  'panaderia-lela-store-v3',
  'panaderia-lela-store-v2',
  'panaderia-lela-store-v1',
]
const MIGRATED_FLAG = 'panaderia-lela-legacy-migrated-v1'

export function readLegacyStore(): unknown | null {
  for (const key of LEGACY_KEYS) {
    try {
      const raw = localStorage.getItem(key)
      if (raw) return JSON.parse(raw)
    } catch {
      // continue
    }
  }
  return null
}

export function wasLegacyMigrated(): boolean {
  return localStorage.getItem(MIGRATED_FLAG) === '1'
}

export function markLegacyMigrated(): void {
  localStorage.setItem(MIGRATED_FLAG, '1')
}
