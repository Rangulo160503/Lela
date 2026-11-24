import { useState } from 'react'
import { ProductPhotoField } from '../../components/ProductPhotoField'
import { SoftConfirm } from '../../components/SoftConfirm'
import { apiPost } from '../../data/api'
import { formatMoney } from '../../domain/buildProforma'
import { AdminDrawer } from './AdminDrawer'

type PromoRow = {
  id: string
  name: string
  price: number
  kind?: string
  active?: number | boolean
  photoPath?: string | null
  components?: { productId: string; quantity: number; substitutable?: number | boolean }[]
}

type PromosPanelProps = {
  promos: PromoRow[]
  products: { id: string; name: string }[]
  onSaved: () => void
  onMessage?: (msg: string) => void
}

type PromoForm = {
  id?: string
  name: string
  price: number
  productId: string
  quantity: number
  photoPath: string
}

const emptyForm: PromoForm = {
  name: '',
  price: 0,
  productId: '',
  quantity: 1,
  photoPath: '',
}

function isActive(p: PromoRow): boolean {
  return p.active !== 0 && p.active !== false
}

export function PromosPanel({ promos, products, onSaved, onMessage }: PromosPanelProps) {
  const [open, setOpen] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [form, setForm] = useState<PromoForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const editing = Boolean(form.id)
  const visible = promos.filter(isActive)

  function openCreate() {
    setForm(emptyForm)
    setOpen(true)
  }

  function openEdit(p: PromoRow) {
    const first = p.components?.[0]
    setForm({
      id: p.id,
      name: p.name,
      price: p.price,
      productId: first?.productId ?? '',
      quantity: first?.quantity ?? 1,
      photoPath: p.photoPath ?? '',
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
    if (!form.productId) {
      onMessage?.('Elegí un componente')
      return
    }
    setSaving(true)
    try {
      await apiPost('/promos', {
        id: form.id,
        name: form.name.trim(),
        kind: 'combo',
        price: form.price,
        photoPath: form.photoPath || null,
        active,
        components: [
          {
            productId: form.productId,
            quantity: form.quantity || 1,
            substitutable: true,
          },
        ],
      })
      onMessage?.(
        !active ? 'Combo eliminado' : editing ? 'Combo actualizado' : 'Combo guardado',
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
        <h2 className="ds-toolbar__title">Combos</h2>
        <button type="button" className="btn btn--primary" onClick={openCreate}>
          Nuevo
        </button>
      </div>

      {visible.length === 0 ? (
        <p className="ds-empty">Sin combos.</p>
      ) : (
        <div className="ds-table-wrap">
          <table className="ds-table">
            <thead>
              <tr>
                <th className="ds-table__thumb-col">Foto</th>
                <th>Nombre</th>
                <th className="ds-table__num">Precio</th>
                <th className="ds-table__action"> </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => (
                <tr
                  key={p.id}
                  className="ds-table__row--clickable"
                  onClick={() => openEdit(p)}
                >
                  <td className="ds-table__thumb-col">
                    <span
                      className="product-thumb"
                      style={
                        p.photoPath
                          ? { backgroundImage: `url(${p.photoPath})` }
                          : undefined
                      }
                      aria-hidden="true"
                    />
                  </td>
                  <td>{p.name}</td>
                  <td className="ds-table__num">{formatMoney(p.price)}</td>
                  <td className="ds-table__action">
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        openEdit(p)
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
        title={editing ? 'Editar combo' : 'Nuevo combo'}
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
            />
          </label>
          <label className="field">
            <span className="field__label">Precio</span>
            <input
              className="field__input"
              type="number"
              inputMode="decimal"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            <span className="field__label">Componente</span>
            <select
              className="field__input"
              value={form.productId}
              onChange={(e) => setForm({ ...form, productId: e.target.value })}
            >
              <option value="">Elegir producto</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Cantidad</span>
            <input
              className="field__input"
              type="number"
              inputMode="numeric"
              min={1}
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
            />
          </label>
          <ProductPhotoField
            value={form.photoPath}
            onChange={(photoPath) => setForm({ ...form, photoPath })}
            onError={onMessage}
            kind="combo"
            label="Foto"
            allowSavedPhotos
          />
        </div>
      </AdminDrawer>

      <SoftConfirm
        open={confirmRemove}
        danger
        title={`¿Eliminar el combo «${form.name || 'este combo'}»?`}
        body="Deja de ofrecerse en facturación."
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
