import type { AppDatabase } from '../da/db.js'

type Nutrition = {
  portion: string
  kcal: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sodium: number
}

type Sample = {
  match: RegExp
  ingredients: string
  nutrition: Nutrition
}

/** Ejemplos para la vitrina (valores ilustrativos, no laboratorio). */
const SAMPLES: Sample[] = [
  {
    match: /bolillo/i,
    ingredients: 'Harina de trigo, agua, levadura, sal, aceite vegetal',
    nutrition: {
      portion: '1 unidad (55 g)',
      kcal: 160,
      protein: 5,
      carbs: 30,
      fat: 2,
      fiber: 1,
      sodium: 280,
    },
  },
  {
    match: /concha/i,
    ingredients:
      'Harina de trigo, azúcar, mantequilla, huevo, levadura, vainilla, colorante vegetal',
    nutrition: {
      portion: '1 unidad (70 g)',
      kcal: 250,
      protein: 5,
      carbs: 38,
      fat: 9,
      fiber: 1,
      sodium: 190,
    },
  },
  {
    match: /cuernito|croissant/i,
    ingredients: 'Harina de trigo, mantequilla, agua, levadura, azúcar, sal, huevo',
    nutrition: {
      portion: '1 unidad (65 g)',
      kcal: 270,
      protein: 5,
      carbs: 28,
      fat: 15,
      fiber: 1,
      sodium: 220,
    },
  },
  {
    match: /oreja/i,
    ingredients: 'Harina de trigo, mantequilla, azúcar, sal',
    nutrition: {
      portion: '1 unidad (50 g)',
      kcal: 230,
      protein: 3,
      carbs: 26,
      fat: 13,
      fiber: 1,
      sodium: 150,
    },
  },
  {
    match: /galleta/i,
    ingredients: 'Harina de trigo, azúcar, mantequilla, huevo, esencia de vainilla',
    nutrition: {
      portion: '1 unidad (35 g)',
      kcal: 170,
      protein: 2,
      carbs: 22,
      fat: 8,
      fiber: 0.5,
      sodium: 95,
    },
  },
  {
    match: /pastelito|pastel/i,
    ingredients:
      'Harina de trigo, azúcar, huevo, leche, mantequilla, polvo de hornear, relleno de crema',
    nutrition: {
      portion: '1 unidad (90 g)',
      kcal: 320,
      protein: 5,
      carbs: 42,
      fat: 14,
      fiber: 1,
      sodium: 210,
    },
  },
  {
    match: /empanada/i,
    ingredients:
      'Harina de trigo, agua, aceite, sal, relleno (según el día: pollo, carne o queso)',
    nutrition: {
      portion: '1 unidad (100 g)',
      kcal: 290,
      protein: 9,
      carbs: 32,
      fat: 14,
      fiber: 2,
      sodium: 380,
    },
  },
  {
    match: /caf[eé]/i,
    ingredients: 'Café molido, agua filtrada (puede servirse con leche o azúcar aparte)',
    nutrition: {
      portion: '1 taza (240 ml, solo)',
      kcal: 5,
      protein: 0.3,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sodium: 5,
    },
  },
  {
    match: /repost/i,
    ingredients: 'Harina, azúcar, huevo, mantequilla, leche (varía según pieza)',
    nutrition: {
      portion: '1 porción (60 g)',
      kcal: 240,
      protein: 4,
      carbs: 34,
      fat: 10,
      fiber: 1,
      sodium: 160,
    },
  },
  {
    match: /pan/i,
    ingredients: 'Harina de trigo, agua, levadura, sal',
    nutrition: {
      portion: '1 rebanada (40 g)',
      kcal: 110,
      protein: 4,
      carbs: 21,
      fat: 1,
      fiber: 1,
      sodium: 200,
    },
  },
]

const FALLBACK: Sample = {
  match: /.*/,
  ingredients: 'Harina de trigo, agua, levadura, sal (receta de ejemplo)',
  nutrition: {
    portion: '1 unidad (60 g)',
    kcal: 200,
    protein: 5,
    carbs: 34,
    fat: 4,
    fiber: 1,
    sodium: 240,
  },
}

function pickSample(name: string): Sample {
  for (const s of SAMPLES) {
    if (s.match.test(name)) return s
  }
  return FALLBACK
}

/** Rellena ingredientes/nutrición de ejemplo solo si el producto aún no los tiene. */
export function seedPublicProductDetails(db: AppDatabase): void {
  const rows = db
    .prepare(
      `SELECT id, name, ingredients_public as ingredients, nutrition_json as nutrition
       FROM products WHERE active = 1`,
    )
    .all() as Array<{
    id: string
    name: string
    ingredients: string
    nutrition: string
  }>

  const update = db.prepare(
    `UPDATE products
     SET ingredients_public = ?, nutrition_json = ?
     WHERE id = ?
       AND (ingredients_public IS NULL OR ingredients_public = '')
       AND (nutrition_json IS NULL OR nutrition_json = '')`,
  )

  const tx = db.transaction(() => {
    for (const row of rows) {
      if ((row.ingredients || '').trim() && (row.nutrition || '').trim()) continue
      const sample = pickSample(row.name)
      update.run(sample.ingredients, JSON.stringify(sample.nutrition), row.id)
    }
  })
  tx()
}
