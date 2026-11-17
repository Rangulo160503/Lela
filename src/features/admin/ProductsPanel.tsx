import { useState } from 'react'
import { ProductPhotoField } from '../../components/ProductPhotoField'
import { apiPost } from '../../data/api'
import { PRODUCT_PHOTO_LIBRARY, productImage } from '../../data/productVisuals'
import { formatMoney } from '../../domain/buildProforma'
import { AdminDrawer } from './AdminDrawer'

type ProductRow = {
  id: string
  name: string
  unitPrice: number
  physicalStock: number
  presentationName?: string
  description?: string
  photoPath?: string | null
}

type ProductsPanelProps = {
  products: ProductRow[]
  onSaved: () => void
  onMessage: (msg: string) => void
}

type ProductForm = {
  id?: string
  name: string
  unitPrice: number
  physicalStock: number
  presentationName: string
  description: string
  photoPath: string
}

const emptyForm: ProductForm = {
  name: '',
  unitPrice: 10,
  physicalStock: 0,
  presentationName: 'Unidad',
  description: '',
  photoPath: PRODUCT_PHOTO_LIBRARY[0]?.path ?? '/images/products/pan.jpg',
}

export function ProductsPanel({ products, onSaved, onMessage }: ProductsPanelProps) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<ProductForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const editing = Boolean(form.id)

  function openCreate() {
    setForm(emptyForm)
    setOpen(true)
  }

  function openEdit(p: ProductRow) {
    setForm({
      id: p.id,
      name: p.name,
      unitPrice: p.unitPrice,
      physicalStock: p.physicalStock,
      presentationName: p.presentationName ?? 'Unidad',
      description: p.description ?? '',
      photoPath: productImage(p),
    })
    setOpen(true)
  }

  function close() {
    setOpen(false)
    setForm(emptyForm)
  }

  async function save() {
    if (!form.name.trim()) {
      onMessage('Nombre requerido')
      return
    }
    setSaving(true)
    try {
      await apiPost('/admin/products', {
        id: form.id,
        name: form.name.trim(),
        unitPrice: form.unitPrice,
        physicalStock: form.physicalStock,
        presentationName: form.presentationName.trim() || 'Unidad',
        description: form.description.trim(),
        photoPath: form.photoPath,
      })
      onMessage(editing ? 'Producto actualizado' : 'Producto guardado')
      close()
      onSaved()
    } catch (err) {
      onMessage(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="admin-panel">
      <div className="ds-toolbar">
        <h2 className="ds-toolbar__title">Productos</h2>
        <button type="button" className="btn btn--primary" onClick={openCreate}>
          Nuevo
        </button>
      </div>

      {products.length === 0 ? (
        <p className="ds-empty">Sin productos.</p>
      ) : (
        <div className="ds-table-wrap">
          <table className="ds-table">
            <thead>
              <tr>
                <th className="ds-table__thumb-col">Foto</th>
                <th>Nombre</th>
                <th className="ds-table__optional">Presentación</th>
                <th className="ds-table__num">Precio</th>
                <th className="ds-table__num">Stock</th>
                <th className="ds-table__action"> </th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr
                  key={p.id}
                  className="ds-table__row--clickable"
                  onClick={() => openEdit(p)}
                >
                  <td className="ds-table__thumb-col">
                    <span
                      className="product-thumb"
                      style={{ backgroundImage: `url(${productImage(p)})` }}
                      aria-hidden="true"
                    />
                  </td>
                  <td>{p.name}</td>
                  <td className="ds-table__optional">
                    {p.presentationName ?? 'Unidad'}
                  </td>
                  <td className="ds-table__num">{formatMoney(p.unitPrice)}</td>
                  <td className="ds-table__num">{p.physicalStock}</td>
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
        title={editing ? 'Editar producto' : 'Nuevo producto'}
        onClose={close}
        footer={
          <div className="admin-form__actions">
            <button type="button" className="btn btn--ghost" onClick={close} disabled={saving}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => void save()}
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
            <span className="field__label">Presentación</span>
            <input
              className="field__input"
              value={form.presentationName}
              onChange={(e) => setForm({ ...form, presentationName: e.target.value })}
              autoComplete="off"
            />
          </label>
          <div className="admin-form__row">
            <label className="field">
              <span className="field__label">Precio</span>
              <input
                className="field__input"
                type="number"
                inputMode="decimal"
                value={form.unitPrice}
                onChange={(e) => setForm({ ...form, unitPrice: Number(e.target.value) })}
              />
            </label>
            <label className="field">
              <span className="field__label">Stock</span>
              <input
                className="field__input"
                type="number"
                inputMode="numeric"
                value={form.physicalStock}
                onChange={(e) =>
                  setForm({ ...form, physicalStock: Number(e.target.value) })
                }
              />
            </label>
          </div>
          <label className="field">
            <span className="field__label">Descripción</span>
            <textarea
              className="field__input"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>

          <ProductPhotoField
            value={form.photoPath}
            onChange={(photoPath) => setForm({ ...form, photoPath })}
            onError={onMessage}
          />
        </div>
      </AdminDrawer>
    </section>
  )
}
