import { useMemo, useState } from 'react'
import { ProductPhotoField } from '../../components/ProductPhotoField'
import { SoftConfirm } from '../../components/SoftConfirm'
import { apiPost } from '../../data/api'
import { formatMoney } from '../../domain/buildProforma'
import { AdminDrawer } from './AdminDrawer'

type MaterialRow = {
  id: string
  name: string
  unit: string
  stock: number
  avgCost?: number
  packSizeKg?: number
  packPrice?: number
  active?: number | boolean
  photoPath?: string | null
}

type MaterialsPanelProps = {
  materials: MaterialRow[]
  onSaved: () => void
  onMessage?: (msg: string) => void
}

type MaterialForm = {
  id?: string
  name: string
  unit: string
  stock: number
  packSizeKg: number
  packPrice: number
  photoPath: string
}

const emptyForm: MaterialForm = {
  name: '',
  unit: 'kg',
  stock: 0,
  packSizeKg: 25,
  packPrice: 0,
  photoPath: '',
}

function isActive(m: MaterialRow): boolean {
  return m.active !== 0 && m.active !== false
}

function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function MaterialsPanel({ materials, onSaved, onMessage }: MaterialsPanelProps) {
  const [open, setOpen] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [form, setForm] = useState<MaterialForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const editing = Boolean(form.id)
  const visible = materials.filter(isActive)

  const costPerKg = useMemo(() => {
    const size = form.packSizeKg > 0 ? form.packSizeKg : 1
    return roundMoney((Number(form.packPrice) || 0) / size)
  }, [form.packSizeKg, form.packPrice])

  function openCreate() {
    setForm(emptyForm)
    setOpen(true)
  }

  function openEdit(m: MaterialRow) {
    const packSizeKg =
      m.packSizeKg && m.packSizeKg > 0
        ? m.packSizeKg
        : 1
    const packPrice =
      typeof m.packPrice === 'number' && m.packPrice > 0
        ? m.packPrice
        : roundMoney((m.avgCost ?? 0) * packSizeKg)
    setForm({
      id: m.id,
      name: m.name,
      unit: m.unit || 'kg',
      stock: m.stock,
      packSizeKg,
      packPrice,
      photoPath: m.photoPath ?? '',
    })
    setOpen(true)
  }

  function close() {
    setOpen(false)
    setForm(emptyForm)
  }

  async function save(active = true) {
    if (!form.name.trim()) {
      onMessage?.('Nombre requerido')
      return
    }
    if (!(form.packSizeKg > 0)) {
      onMessage?.('El saco/paquete debe ser mayor a 0 kg')
      return
    }
    setSaving(true)
    try {
      await apiPost('/raw-materials', {
        id: form.id,
        name: form.name.trim(),
        unit: form.unit.trim() || 'kg',
        stock: form.stock,
        packSizeKg: form.packSizeKg,
        packPrice: form.packPrice,
        avgCost: costPerKg,
        photoPath: form.photoPath || null,
        active,
      })
      onMessage?.(
        !active
          ? 'Materia prima eliminada'
          : editing
            ? 'Materia prima actualizada'
            : 'Materia prima guardada',
      )
      close()
      onSaved()
    } catch (err) {
      onMessage?.(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!form.id) return
    await save(false)
  }

  return (
    <section className="admin-panel">
      <div className="ds-toolbar">
        <h2 className="ds-toolbar__title">Materia prima</h2>
        <button type="button" className="btn btn--primary" onClick={openCreate}>
          Nuevo
        </button>
      </div>

      {visible.length === 0 ? (
        <p className="ds-empty">Sin materia prima.</p>
      ) : (
        <div className="ds-table-wrap">
          <table className="ds-table">
            <thead>
              <tr>
                <th className="ds-table__thumb-col">Foto</th>
                <th>Nombre</th>
                <th className="ds-table__num">Saco</th>
                <th className="ds-table__num">₡/kg</th>
                <th className="ds-table__num">Stock</th>
                <th className="ds-table__action"> </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((m) => (
                <tr
                  key={m.id}
                  className="ds-table__row--clickable"
                  onClick={() => openEdit(m)}
                >
                  <td className="ds-table__thumb-col">
                    <span
                      className="product-thumb"
                      style={
                        m.photoPath
                          ? { backgroundImage: `url(${m.photoPath})` }
                          : undefined
                      }
                      aria-hidden="true"
                    />
                  </td>
                  <td>{m.name}</td>
                  <td className="ds-table__num">
                    {m.packSizeKg && m.packSizeKg > 0
                      ? `${m.packSizeKg} kg`
                      : '—'}
                  </td>
                  <td className="ds-table__num">{formatMoney(m.avgCost ?? 0)}</td>
                  <td className="ds-table__num">{m.stock}</td>
                  <td className="ds-table__action">
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        openEdit(m)
                      }}
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AdminDrawer
        open={open}
        title={editing ? 'Editar materia prima' : 'Nueva materia prima'}
        onClose={close}
        footer={
          <div className="admin-form__actions">
            {editing ? (
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => setConfirmRemove(true)}
                disabled={saving}
              >
                Eliminar
              </button>
            ) : (
              <button type="button" className="btn btn--ghost" onClick={close} disabled={saving}>
                Cancelar
              </button>
            )}
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => void save(true)}
              disabled={saving}
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        }
      >
        <div className="admin-form">
          <label className="field">
            <span className="field__label">Nombre</span>
            <input
              className="field__input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoComplete="off"
              placeholder="Ej. Harina"
            />
          </label>

          <div className="admin-form__row">
            <label className="field">
              <span className="field__label">Saco / paquete (kg)</span>
              <input
                className="field__input"
                type="number"
                inputMode="decimal"
                min={0.001}
                step="any"
                value={form.packSizeKg}
                onChange={(e) =>
                  setForm({ ...form, packSizeKg: Number(e.target.value) })
                }
              />
            </label>
            <label className="field">
              <span className="field__label">Precio del saco (₡)</span>
              <input
                className="field__input"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={form.packPrice}
                onChange={(e) =>
                  setForm({ ...form, packPrice: Number(e.target.value) })
                }
              />
            </label>
          </div>

          <div className="recipe-cost-sheet__kpi">
            <span className="recipe-cost-sheet__kpi-label">₡ por kilo (auto)</span>
            <strong className="recipe-cost-sheet__kpi-value">
              {formatMoney(costPerKg)}
            </strong>
            <span className="photo-field__hint">
              Ej. saco 25 kg a ₡18 000 → {formatMoney(18000 / 25)} / kg. Ese valor
              llega solo a las recetas.
            </span>
          </div>

          <div className="admin-form__row">
            <label className="field">
              <span className="field__label">Stock (kg)</span>
              <input
                className="field__input"
                type="number"
                inputMode="decimal"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
              />
            </label>
            <label className="field">
              <span className="field__label">Unidad</span>
              <input
                className="field__input"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                autoComplete="off"
              />
            </label>
          </div>

          <ProductPhotoField
            value={form.photoPath}
            onChange={(photoPath) => setForm({ ...form, photoPath })}
            onError={onMessage}
            kind="material"
            label="Foto"
            allowSavedPhotos
          />
        </div>
      </AdminDrawer>

      <SoftConfirm
        open={confirmRemove}
        danger
        title={`¿Eliminar «${form.name || 'esta materia'}»?`}
        body="Deja de aparecer en recetas nuevas y en el listado."
        confirmLabel="Sí, eliminar"
        onCancel={() => setConfirmRemove(false)}
        onConfirm={() => {
          setConfirmRemove(false)
          void remove()
        }}
      />
    </section>
  )
}
