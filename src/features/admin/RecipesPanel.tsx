import { useMemo, useRef, useState } from 'react'
import { ProductPhotoField } from '../../components/ProductPhotoField'
import { SoftConfirm } from '../../components/SoftConfirm'
import { apiPost } from '../../data/api'
import { formatMoney } from '../../domain/buildProforma'
import { fileToJpegDataUrl } from '../../lib/imageCapture'
import { AdminDrawer } from './AdminDrawer'

type RecipeRow = {
  id: string
  name: string
  version: number
  productId?: string
  notes?: string
  photoPath?: string | null
  batchYield?: number
  active?: number | boolean
  ingredients?: { rawMaterialId: string; quantity: number }[]
}

type IngredientLine = {
  rawMaterialId: string
  gramsPerKg: number
  /** ₡ por kilo; se puede editar aquí (no solo en Materia prima). */
  costPerKg: number
  hint?: string
  unmatched?: boolean
}

type RecipeForm = {
  id?: string
  productId: string
  name: string
  notes: string
  photoPath: string
  baseKg: number
  batchYield: number
  ingredients: IngredientLine[]
}

type MaterialOpt = {
  id: string
  name: string
  unit?: string
  avgCost?: number
  packSizeKg?: number
  packPrice?: number
  active?: number | boolean
}

type ProductOpt = {
  id: string
  name: string
  unitPrice?: number
}

type RecipesPanelProps = {
  recipes: RecipeRow[]
  products: ProductOpt[]
  materials: MaterialOpt[]
  onSaved: () => void
  onMessage?: (msg: string) => void
}

const emptyForm = (): RecipeForm => ({
  productId: '',
  name: '',
  notes: '',
  photoPath: '',
  baseKg: 1,
  batchYield: 1,
  ingredients: [{ rawMaterialId: '', gramsPerKg: 1000, costPerKg: 0 }],
})

function isActive(r: { active?: number | boolean }): boolean {
  return r.active !== 0 && r.active !== false
}

function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function percentToGrams(percent: number): number {
  return percent * 10
}

function gramsToPercent(grams: number): number {
  return grams / 10
}

export function RecipesPanel({
  recipes,
  products,
  materials,
  onSaved,
  onMessage,
}: RecipesPanelProps) {
  const fillRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<RecipeForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [filling, setFilling] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const editing = Boolean(form.id)
  const visible = recipes.filter(isActive)
  const activeMaterials = materials.filter(isActive)
  const productNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of products) map.set(p.id, p.name)
    return map
  }, [products])

  const materialById = useMemo(() => {
    const map = new Map<string, MaterialOpt>()
    for (const m of activeMaterials) map.set(m.id, m)
    return map
  }, [activeMaterials])

  const selectedProduct = products.find((p) => p.id === form.productId)
  const baseKg = form.baseKg > 0 ? form.baseKg : 1

  const costing = useMemo(() => {
    const lines = form.ingredients.map((line) => {
      const mat = line.rawMaterialId
        ? materialById.get(line.rawMaterialId)
        : undefined
      const costPerKg = Number(line.costPerKg) || 0
      const gramsPerKg = Number(line.gramsPerKg) || 0
      const gramsBatch = gramsPerKg * baseKg
      const kgBatch = gramsBatch / 1000
      const subtotal = roundMoney(kgBatch * costPerKg)
      return {
        ...line,
        gramsBatch,
        kgBatch,
        costPerKg,
        subtotal,
        catalogCost: mat?.avgCost ?? 0,
      }
    })
    const doughKg = roundMoney(lines.reduce((sum, l) => sum + l.kgBatch, 0))
    const batchCost = roundMoney(lines.reduce((sum, l) => sum + l.subtotal, 0))
    const yieldPerKg =
      typeof form.batchYield === 'number' && form.batchYield > 0
        ? form.batchYield
        : 1
    const yieldTotal = yieldPerKg * baseKg
    const unitCost = roundMoney(batchCost / yieldTotal)
    const sellPrice = selectedProduct?.unitPrice ?? 0
    const margin = sellPrice > 0 ? roundMoney(sellPrice - unitCost) : null
    const marginPct =
      sellPrice > 0 ? roundMoney(((sellPrice - unitCost) / sellPrice) * 100) : null
    return {
      lines,
      doughKg,
      batchCost,
      yieldPerKg,
      yieldTotal,
      unitCost,
      sellPrice,
      margin,
      marginPct,
    }
  }, [form.ingredients, form.batchYield, baseKg, materialById, selectedProduct])

  function openCreate() {
    setForm(emptyForm())
    setOpen(true)
  }

  function openEdit(r: RecipeRow) {
    const lines =
      r.ingredients && r.ingredients.length > 0
        ? r.ingredients.map((ing) => {
            const mat = materialById.get(ing.rawMaterialId)
            return {
              rawMaterialId: ing.rawMaterialId,
              gramsPerKg: percentToGrams(ing.quantity),
              costPerKg: mat?.avgCost ?? 0,
            }
          })
        : [{ rawMaterialId: '', gramsPerKg: 1000, costPerKg: 0 }]
    setForm({
      id: r.id,
      productId: r.productId ?? '',
      name: r.name,
      notes: r.notes ?? '',
      photoPath: r.photoPath ?? '',
      baseKg: 1,
      batchYield: r.batchYield && r.batchYield > 0 ? r.batchYield : 1,
      ingredients: lines,
    })
    setOpen(true)
  }

  function close() {
    setOpen(false)
    setConfirmRemove(false)
    setForm(emptyForm())
  }

  function updateIngredient(index: number, patch: Partial<IngredientLine>) {
    setForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((line, i) =>
        i === index ? { ...line, ...patch } : line,
      ),
    }))
  }

  function addIngredient() {
    setForm((prev) => ({
      ...prev,
      ingredients: [
        ...prev.ingredients,
        { rawMaterialId: '', gramsPerKg: 0, costPerKg: 0 },
      ],
    }))
  }

  function onMaterialChange(index: number, materialId: string) {
    const mat = materialById.get(materialId)
    const name = (mat?.name ?? '').toLowerCase()
    const looksFlour = /harina|flour/.test(name)
    const shouldBase =
      looksFlour &&
      (index === 0 ||
        form.ingredients.every((l, i) => i === index || !l.rawMaterialId))
    updateIngredient(index, {
      rawMaterialId: materialId,
      unmatched: false,
      hint: undefined,
      costPerKg: mat?.avgCost ?? 0,
      ...(shouldBase && !(Number(form.ingredients[index]?.gramsPerKg) > 0)
        ? { gramsPerKg: 1000 }
        : {}),
    })
  }

  function onBatchGramsChange(index: number, batchGrams: number) {
    const gramsPerKg = baseKg > 0 ? batchGrams / baseKg : batchGrams
    updateIngredient(index, { gramsPerKg })
  }

  function removeIngredient(index: number) {
    setForm((prev) => ({
      ...prev,
      ingredients:
        prev.ingredients.length <= 1
          ? prev.ingredients
          : prev.ingredients.filter((_, i) => i !== index),
    }))
  }

  async function fillFromPhoto(file: File | undefined) {
    if (!file) return
    setFilling(true)
    try {
      const dataUrl = await fileToJpegDataUrl(file)
      const upload = await apiPost<
        { ok: true; path: string } | { ok: false; error: string }
      >('/uploads', { dataUrl, kind: 'recipe' })
      if (!upload.ok) {
        onMessage?.(upload.error || 'No se pudo subir la foto')
        return
      }
      setForm((prev) => ({ ...prev, photoPath: upload.path }))

      const parsed = await apiPost<{
        ok: true
        recipe: {
          name: string
          notes: string
          productId: string | null
          ingredients: {
            name: string
            quantity: number
            rawMaterialId: string | null
            unmatched: boolean
          }[]
        }
      } | { ok: false; error: string; message?: string }>('/recipes/parse-photo', {
        dataUrl,
        photoPath: upload.path,
      })

      if (!parsed.ok) {
        if (parsed.error === 'vision_not_configured') {
          onMessage?.(
            'Foto guardada. Para rellenar automático configurá LELA_VISION_API_KEY (o OPENAI_API_KEY).',
          )
        } else {
          onMessage?.(
            parsed.message ||
              'Foto guardada; completá gramos y ₡/kg a mano.',
          )
        }
        return
      }

      const lines =
        parsed.recipe.ingredients.length > 0
          ? parsed.recipe.ingredients.map((ing) => {
              const q = Number(ing.quantity) || 0
              const gramsPerKg = q > 200 ? q : percentToGrams(q)
              const mat = ing.rawMaterialId
                ? materialById.get(ing.rawMaterialId)
                : undefined
              return {
                rawMaterialId: ing.rawMaterialId ?? '',
                gramsPerKg,
                costPerKg: mat?.avgCost ?? 0,
                hint: ing.unmatched ? ing.name : undefined,
                unmatched: ing.unmatched,
              }
            })
          : [{ rawMaterialId: '', gramsPerKg: 1000, costPerKg: 0 }]

      setForm((prev) => ({
        ...prev,
        photoPath: upload.path,
        name: parsed.recipe.name || prev.name,
        notes: parsed.recipe.notes || prev.notes,
        productId: parsed.recipe.productId || prev.productId,
        ingredients: lines,
      }))
      onMessage?.('Receta rellenada. Revisá gramos y poné el ₡/kg de cada materia.')
    } catch (err) {
      onMessage?.(err instanceof Error ? err.message : 'No se pudo usar la foto')
    } finally {
      setFilling(false)
      if (fillRef.current) fillRef.current.value = ''
    }
  }

  async function save(active = true) {
    if (!form.productId) {
      onMessage?.('Elegí el producto')
      return
    }
    if (!form.name.trim()) {
      onMessage?.('Poné el nombre de la receta')
      return
    }
    const ingredients = form.ingredients.filter(
      (l) => l.rawMaterialId && l.gramsPerKg > 0,
    )
    if (ingredients.length === 0) {
      onMessage?.('Agregá al menos un ingrediente')
      return
    }
    setSaving(true)
    try {
      // Si ajustó ₡/kg aquí, actualizar materia (y precio del saco si hay tamaño)
      for (const line of ingredients) {
        const mat = materialById.get(line.rawMaterialId)
        if (!mat) continue
        if ((line.costPerKg || 0) <= 0) continue
        if (Math.abs((mat.avgCost ?? 0) - line.costPerKg) < 0.005) continue
        const packSizeKg =
          mat.packSizeKg && mat.packSizeKg > 0 ? mat.packSizeKg : 1
        await apiPost('/raw-materials', {
          id: mat.id,
          name: mat.name,
          unit: mat.unit || 'kg',
          packSizeKg,
          packPrice: line.costPerKg * packSizeKg,
          avgCost: line.costPerKg,
        })
      }

      await apiPost('/recipes', {
        id: form.id,
        productId: form.productId,
        name: form.name.trim(),
        notes: form.notes.trim(),
        photoPath: form.photoPath || null,
        batchYield: form.batchYield > 0 ? form.batchYield : 1,
        official: true,
        active,
        ingredients: ingredients.map((l) => ({
          rawMaterialId: l.rawMaterialId,
          quantity: gramsToPercent(l.gramsPerKg),
        })),
      })
      onMessage?.(
        !active ? 'Receta eliminada' : editing ? 'Receta actualizada' : 'Receta guardada',
      )
      close()
      onSaved()
    } catch (err) {
      onMessage?.(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="admin-panel">
      <div className="ds-toolbar">
        <h2 className="ds-toolbar__title">Recetas</h2>
        <button type="button" className="btn btn--primary" onClick={openCreate}>
          Nueva
        </button>
      </div>

      {visible.length === 0 ? (
        <p className="ds-empty">Todavía no hay recetas. Creá la primera.</p>
      ) : (
        <ul className="recipe-list">
          {visible.map((r) => {
            const productLabel = r.productId
              ? productNameById.get(r.productId)
              : undefined
            return (
              <li key={r.id}>
                <button
                  type="button"
                  className="recipe-list__card"
                  onClick={() => openEdit(r)}
                >
                  <span
                    className="recipe-list__thumb"
                    style={
                      r.photoPath
                        ? { backgroundImage: `url(${r.photoPath})` }
                        : undefined
                    }
                    aria-hidden="true"
                  />
                  <span className="recipe-list__copy">
                    <span className="recipe-list__name">{r.name}</span>
                    <span className="recipe-list__meta">
                      {productLabel ?? 'Sin producto'}
                    </span>
                  </span>
                  <span className="recipe-list__chev" aria-hidden="true">
                    ›
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <AdminDrawer
        open={open}
        wide
        title={editing ? form.name || 'Editar receta' : 'Nueva receta'}
        onClose={close}
        footer={
          <div className="admin-form__actions">
            {editing ? (
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => setConfirmRemove(true)}
                disabled={saving || filling}
              >
                Eliminar
              </button>
            ) : (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={close}
                disabled={saving || filling}
              >
                Cancelar
              </button>
            )}
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => void save(true)}
              disabled={saving || filling}
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        }
      >
        <div className="admin-form recipe-form">
          <div className="recipe-form__strip" aria-live="polite">
            <div className="recipe-form__strip-item">
              <span className="recipe-form__strip-label">Costo / u</span>
              <strong>{formatMoney(costing.unitCost)}</strong>
            </div>
            <div className="recipe-form__strip-item">
              <span className="recipe-form__strip-label">Venta</span>
              <strong>
                {selectedProduct ? formatMoney(costing.sellPrice) : '—'}
              </strong>
            </div>
            <div className="recipe-form__strip-item">
              <span className="recipe-form__strip-label">Margen</span>
              <strong>
                {costing.margin == null
                  ? '—'
                  : `${formatMoney(costing.margin)}${
                      costing.marginPct != null ? ` · ${costing.marginPct}%` : ''
                    }`}
              </strong>
            </div>
          </div>

          <section className="recipe-step">
            <div className="admin-form__row">
              <label className="field">
                <span className="field__label">Producto</span>
                <select
                  className="field__input"
                  value={form.productId}
                  onChange={(e) => setForm({ ...form, productId: e.target.value })}
                >
                  <option value="">Elegir…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field__label">Nombre de la receta</span>
                <input
                  className="field__input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  autoComplete="off"
                  placeholder="Ej. Pan francés"
                />
              </label>
            </div>
            <div className="admin-form__row recipe-form__scale-row">
              <label className="field">
                <span className="field__label">Kilos de harina</span>
                <input
                  className="field__input"
                  type="number"
                  inputMode="decimal"
                  min={0.01}
                  step="any"
                  value={form.baseKg}
                  onChange={(e) =>
                    setForm({ ...form, baseKg: Number(e.target.value) || 1 })
                  }
                />
              </label>
              <label className="field">
                <span className="field__label">Unidades por 1 kg harina</span>
                <input
                  className="field__input"
                  type="number"
                  inputMode="decimal"
                  min={0.01}
                  step="any"
                  value={form.batchYield}
                  onChange={(e) =>
                    setForm({ ...form, batchYield: Number(e.target.value) })
                  }
                />
                <span className="photo-field__hint">
                  Con {baseKg} kg ≈ {costing.yieldTotal.toFixed(0)} unidades · lote{' '}
                  {formatMoney(costing.batchCost)}
                </span>
              </label>
            </div>
          </section>

          <section className="recipe-step">
            <div className="recipe-ingredients__head">
              <h3 className="recipe-step__title">Ingredientes</h3>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={addIngredient}
                disabled={saving || filling}
              >
                + Línea
              </button>
            </div>
            <p className="photo-field__hint">
              Gramos según los kilos de harina. El ₡/kg sale del saco; si lo
              cambiás aquí, se actualiza en Materia prima.
            </p>

            <div className="ds-table-wrap recipe-cost-sheet__wrap">
              <table className="ds-table recipe-cost-sheet__table">
                <thead>
                  <tr>
                    <th>Materia</th>
                    <th className="ds-table__num">g</th>
                    <th className="ds-table__num">₡/kg</th>
                    <th className="ds-table__num">Subtotal</th>
                    <th className="ds-table__action"> </th>
                  </tr>
                </thead>
                <tbody>
                  {costing.lines.map((line, index) => (
                    <tr key={index}>
                      <td>
                        <select
                          className="field__input"
                          value={line.rawMaterialId}
                          aria-label={`Materia ${index + 1}`}
                          onChange={(e) => onMaterialChange(index, e.target.value)}
                        >
                          <option value="">
                            {line.hint ? `Elegir (${line.hint})` : 'Elegir…'}
                          </option>
                          {activeMaterials.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="ds-table__num">
                        <input
                          className="field__input field__input--compact"
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="any"
                          value={Number(line.gramsBatch.toFixed(2))}
                          aria-label={`Gramos ${index + 1}`}
                          onChange={(e) =>
                            onBatchGramsChange(index, Number(e.target.value))
                          }
                        />
                      </td>
                      <td className="ds-table__num">
                        <input
                          className="field__input field__input--compact"
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="any"
                          value={line.costPerKg}
                          aria-label={`Costo por kilo ${index + 1}`}
                          placeholder="2000"
                          onChange={(e) =>
                            updateIngredient(index, {
                              costPerKg: Number(e.target.value),
                            })
                          }
                        />
                      </td>
                      <td className="ds-table__num">{formatMoney(line.subtotal)}</td>
                      <td className="ds-table__action">
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          onClick={() => removeIngredient(index)}
                          disabled={
                            form.ingredients.length <= 1 || saving || filling
                          }
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <details className="recipe-step recipe-step--optional">
            <summary className="recipe-step__title">Foto y notas</summary>
            <div className="recipe-fill">
              <button
                type="button"
                className="btn btn--secondary"
                disabled={saving || filling}
                onClick={() => fillRef.current?.click()}
              >
                {filling ? 'Leyendo foto…' : 'Usar foto para rellenar'}
              </button>
              <input
                ref={fillRef}
                className="visually-hidden"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => void fillFromPhoto(e.target.files?.[0])}
              />
            </div>
            <ProductPhotoField
              value={form.photoPath}
              onChange={(photoPath) => setForm({ ...form, photoPath })}
              onError={onMessage}
              kind="recipe"
              label="Foto de la ficha"
              allowSavedPhotos
            />
            <label className="field">
              <span className="field__label">Notas</span>
              <textarea
                className="field__input"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </label>
          </details>
        </div>
      </AdminDrawer>

      <SoftConfirm
        open={confirmRemove}
        danger
        title={`¿Eliminar «${form.name || 'esta receta'}»?`}
        body="Se oculta de la lista. Podés volver a crearla después."
        confirmLabel="Sí, eliminar"
        onCancel={() => setConfirmRemove(false)}
        onConfirm={() => {
          setConfirmRemove(false)
          void save(false)
        }}
      />
    </section>
  )
}
