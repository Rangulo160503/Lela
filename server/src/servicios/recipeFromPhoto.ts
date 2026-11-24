/**
 * Extrae receta estructurada desde una foto (visión opcional).
 * Requiere LELA_VISION_API_KEY o OPENAI_API_KEY (compatible OpenAI).
 */

export type CatalogMaterial = { id: string; name: string; unit?: string }
export type CatalogProduct = { id: string; name: string }

export type ParsedIngredient = {
  name: string
  quantity: number
  unit?: string
  rawMaterialId: string | null
  unmatched: boolean
}

export type ParsedRecipe = {
  name: string
  notes: string
  productId: string | null
  ingredients: ParsedIngredient[]
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function scoreMatch(a: string, b: string): number {
  const na = normalize(a)
  const nb = normalize(b)
  if (!na || !nb) return 0
  if (na === nb) return 100
  if (na.includes(nb) || nb.includes(na)) return 80
  const ta = new Set(na.split(' '))
  const tb = new Set(nb.split(' '))
  let hit = 0
  for (const t of ta) if (tb.has(t)) hit += 1
  if (hit === 0) return 0
  return Math.round((hit / Math.max(ta.size, tb.size)) * 60)
}

function bestId(
  name: string,
  catalog: { id: string; name: string }[],
): string | null {
  let best: { id: string; score: number } | null = null
  for (const item of catalog) {
    const score = scoreMatch(name, item.name)
    if (score < 50) continue
    if (!best || score > best.score) best = { id: item.id, score }
  }
  return best?.id ?? null
}

function visionConfigured(): { key: string; base: string; model: string } | null {
  const key =
    process.env.LELA_VISION_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    ''
  if (!key) return null
  const base = (
    process.env.LELA_VISION_BASE_URL?.trim() ||
    'https://api.openai.com/v1'
  ).replace(/\/$/, '')
  const model =
    process.env.LELA_VISION_MODEL?.trim() || 'gpt-4o-mini'
  return { key, base, model }
}

function extractJson(raw: string): unknown {
  const trimmed = raw.trim()
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed)
  const body = fence ? fence[1] : trimmed
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start < 0 || end < start) throw new Error('invalid_json')
  return JSON.parse(body.slice(start, end + 1))
}

export async function parseRecipeFromPhoto(input: {
  dataUrl: string
  materials: CatalogMaterial[]
  products: CatalogProduct[]
}): Promise<
  | { ok: true; recipe: ParsedRecipe; provider: 'vision' }
  | { ok: false; error: 'vision_not_configured' | 'vision_failed' | 'invalid_image'; message?: string }
> {
  const cfg = visionConfigured()
  if (!cfg) {
    return { ok: false, error: 'vision_not_configured' }
  }

  const match = /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/i.exec(
    input.dataUrl,
  )
  if (!match) {
    return { ok: false, error: 'invalid_image' }
  }

  const materialNames = input.materials.map((m) => m.name).join(', ')
  const productNames = input.products.map((p) => p.name).join(', ')

  const prompt = `Sos un asistente de panadería en Costa Rica. Extraé la receta de la imagen.
La ficha se expresa en GRAMOS por cada 1 kg de harina (base). Ej.: harina 1000, agua 250, sal 20.
Respondé SOLO JSON válido con esta forma:
{"name":"string","notes":"string","ingredients":[{"name":"string","quantity":number,"unit":"g"}]}
- name: título de la receta
- notes: pasos o notas (puede ser "")
- ingredients: quantity = gramos por 1 kg de harina (harina 1000, agua 250, etc.). Si la ficha trae %, convertí a gramos (20% → 200).
Materias primas conocidas: ${materialNames || '(ninguna)'}
Productos conocidos: ${productNames || '(ninguno)'}
Si un nombre coincide con el catálogo, usá ese nombre exacto.`

  try {
    const res = await fetch(`${cfg.base}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: cfg.model,
        temperature: 0.1,
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: input.dataUrl } },
            ],
          },
        ],
      }),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return {
        ok: false,
        error: 'vision_failed',
        message: detail.slice(0, 240) || `HTTP ${res.status}`,
      }
    }

    const payload = (await res.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    const content = payload.choices?.[0]?.message?.content ?? ''
    const parsed = extractJson(content) as {
      name?: string
      notes?: string
      ingredients?: { name?: string; quantity?: number; unit?: string }[]
    }

    const ingredients: ParsedIngredient[] = (parsed.ingredients ?? [])
      .map((ing) => {
        const name = String(ing.name ?? '').trim()
        if (!name) return null
        const quantity = Number(ing.quantity)
        const rawMaterialId = bestId(name, input.materials)
        return {
          name,
          quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
          unit: ing.unit ? String(ing.unit) : undefined,
          rawMaterialId,
          unmatched: !rawMaterialId,
        }
      })
      .filter((x): x is ParsedIngredient => x !== null)

    const recipeName = String(parsed.name ?? '').trim() || 'Receta'
    const productId = bestId(recipeName, input.products)

    return {
      ok: true,
      provider: 'vision',
      recipe: {
        name: recipeName,
        notes: String(parsed.notes ?? '').trim(),
        productId,
        ingredients,
      },
    }
  } catch (err) {
    return {
      ok: false,
      error: 'vision_failed',
      message: err instanceof Error ? err.message : 'vision_failed',
    }
  }
}
