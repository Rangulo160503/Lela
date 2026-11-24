/**
 * Extrae datos de gasto/factura desde una foto (visión opcional).
 * Requiere LELA_VISION_API_KEY o OPENAI_API_KEY.
 */

export type ParsedExpense = {
  description: string
  amount: number
  category: string
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
  const model = process.env.LELA_VISION_MODEL?.trim() || 'gpt-4o-mini'
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

function normalizeCategory(raw: string): string {
  const v = String(raw || '')
    .toLowerCase()
    .trim()
  if (v.indexOf('fact') >= 0) return 'factura'
  if (v.indexOf('comp') >= 0) return 'compra'
  if (v.indexOf('otro') >= 0) return 'otro'
  return 'gasto'
}

export async function parseExpenseFromPhoto(input: {
  dataUrl: string
}): Promise<
  | { ok: true; expense: ParsedExpense; provider: 'vision' }
  | {
      ok: false
      error: 'vision_not_configured' | 'vision_failed' | 'invalid_image'
      message?: string
    }
> {
  const cfg = visionConfigured()
  if (!cfg) {
    return { ok: false, error: 'vision_not_configured' }
  }

  const match =
    /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/i.exec(
      input.dataUrl,
    )
  if (!match) {
    return { ok: false, error: 'invalid_image' }
  }

  const prompt = `Sos un asistente de panadería en Costa Rica. Leé la foto de una factura o recibo de gasto.
Respondé SOLO JSON válido con esta forma:
{"description":"string","amount":number,"category":"factura"|"gasto"|"compra"|"otro"}
- description: comercio o concepto corto (ej. "Factura Maxi Pali", "Gasolina")
- amount: total a pagar en colones (número, sin símbolos). Si hay IVA, usá el total final.
- category: factura si parece factura formal; compra si es mercancía; gasto para egreso general; otro si no encaja.
Si no podés leer el monto, poné amount: 0 y description con lo que sí se lea.`

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
        max_tokens: 400,
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
      description?: string
      amount?: number
      category?: string
    }

    const amount = Number(parsed.amount)
    return {
      ok: true,
      provider: 'vision',
      expense: {
        description: String(parsed.description ?? '').trim() || 'Gasto',
        amount: Number.isFinite(amount) && amount > 0 ? Math.round(amount) : 0,
        category: normalizeCategory(String(parsed.category ?? 'gasto')),
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
