import type { AppDatabase } from '../da/db.js'

export type BakeryPublicInfo = {
  name: string
  eyebrow: string
  tagline: string
  address: string
  phone: string
  hours: string
  note: string
}

const SETTINGS_KEY = 'bakery_public'

/** Datos de ejemplo; el encargado los cambia en Config → Menú público. */
export const DEFAULT_BAKERY_PUBLIC: BakeryPublicInfo = {
  name: 'Panadería Lela',
  eyebrow: 'Desde el horno',
  tagline: 'El sabor de cada día, listo para servir.',
  address: 'Centro, Costa Rica (completar dirección exacta)',
  phone: '+506 8888-0000',
  hours: 'Lunes a sábado 6:00 a. m. – 6:00 p. m. · Domingos 6:00 a. m. – 2:00 p. m.',
  note: 'Precios en colones. Sujeto a disponibilidad del día. ¡Los esperamos!',
}

function normalize(input: Partial<BakeryPublicInfo> | null | undefined): BakeryPublicInfo {
  const src = input ?? {}
  return {
    name: String(src.name ?? DEFAULT_BAKERY_PUBLIC.name).trim() || DEFAULT_BAKERY_PUBLIC.name,
    eyebrow: String(src.eyebrow ?? DEFAULT_BAKERY_PUBLIC.eyebrow).trim(),
    tagline: String(src.tagline ?? DEFAULT_BAKERY_PUBLIC.tagline).trim(),
    address: String(src.address ?? '').trim(),
    phone: String(src.phone ?? '').trim(),
    hours: String(src.hours ?? '').trim(),
    note: String(src.note ?? '').trim(),
  }
}

export function getBakeryPublic(db: AppDatabase): BakeryPublicInfo {
  const row = db
    .prepare(`SELECT value FROM meta WHERE key = ?`)
    .get(SETTINGS_KEY) as { value: string } | undefined
  if (!row) {
    // Primera vez: deja ejemplos guardados para que Config y /menu ya muestren algo.
    return saveBakeryPublic(db, DEFAULT_BAKERY_PUBLIC)
  }
  try {
    return normalize(JSON.parse(row.value) as Partial<BakeryPublicInfo>)
  } catch {
    return saveBakeryPublic(db, DEFAULT_BAKERY_PUBLIC)
  }
}

export function saveBakeryPublic(
  db: AppDatabase,
  input: Partial<BakeryPublicInfo>,
): BakeryPublicInfo {
  const next = normalize(input)
  db.prepare(
    `INSERT INTO meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(SETTINGS_KEY, JSON.stringify(next))
  return next
}
