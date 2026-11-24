import { useCallback, useState } from 'react'
import { ProductPhotoField } from '../components/ProductPhotoField'
import { SoftConfirm } from '../components/SoftConfirm'
import { SoftToast } from '../components/SoftToast'
import { apiPost } from '../data/api'
import { PRODUCT_PHOTO_LIBRARY, productImage, SCENE } from '../data/productVisuals'
import { formatMoney } from '../domain/buildProforma'
import type { Product } from '../domain/types'
import { AdminDrawer } from '../features/admin/AdminDrawer'
import { MermaModal } from '../features/inventario/MermaModal'
import { ProductionHistory } from '../features/inventario/ProductionHistory'
import { ProductionSheetModal } from '../features/inventario/ProductionSheetModal'
import { useInventory } from '../features/inventario/InventoryContext'

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('es-CR', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

type EditForm = {
  id: string
  name: string
  unitPrice: number
  physicalStock: number
  photoPath: string
}

export function InventarioPage() {
  const { products, productionSheets, mermaRecords, refresh } = useInventory()
  const [mermaOpen, setMermaOpen] = useState(false)
  const [productionOpen, setProductionOpen] = useState(false)
  const [form, setForm] = useState<EditForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [toastTone, setToastTone] = useState<'ok' | 'warn' | 'error'>('ok')
  const [confirmRemove, setConfirmRemove] = useState(false)
  const dismissToast = useCallback(() => setMessage(null), [])
  const notify = useCallback((msg: string, tone: 'ok' | 'warn' | 'error' = 'ok') => {
    let next: 'ok' | 'warn' | 'error' = tone
    if (/error|no se pudo|falló|requerid/i.test(msg)) next = 'error'
    setToastTone(next)
    setMessage(msg)
  }, [])

  function openEdit(product: Product) {
    setForm({
      id: product.id,
      name: product.name,
      unitPrice: product.unitPrice,
      physicalStock: product.physicalStock,
      photoPath: productImage(product),
    })
    setMessage(null)
    setConfirmRemove(false)
  }

  function closeEdit() {
    setForm(null)
    setMessage(null)
    setConfirmRemove(false)
  }

  async function save(active = true) {
    if (!form) return
    if (!form.name.trim()) {
      notify('Nombre requerido', 'error')
      return
    }
    setSaving(true)
    try {
      await apiPost('/admin/products', {
        id: form.id,
        name: form.name.trim(),
        unitPrice: form.unitPrice,
        physicalStock: form.physicalStock,
        photoPath: form.photoPath || PRODUCT_PHOTO_LIBRARY[0]?.path,
        active,
      })
      notify(!active ? 'Producto eliminado' : 'Producto actualizado')
      closeEdit()
      await refresh()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'No se pudo guardar', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!form) return
    await save(false)
  }

  return (
    <main className="page page--wide page--editorial">
      <header className="module-head module-head--ops module-head--compact-media">
        <div className="module-head__copy">
          <p className="module-head__kicker ops-hide-mobile">Bodega y horno</p>
          <h1 className="module-head__title">Inventario</h1>
          <p className="module-head__lede ops-hide-mobile">
            Stock físico, fotos, producción y mermas. Tocá un producto para editarlo.
          </p>
        </div>
        <figure className="module-head__media ops-hide-mobile">
          <img src={SCENE.ingredients} alt="" decoding="async" />
        </figure>
      </header>

      <div className="ds-toolbar">
        <div className="ds-toolbar__start">
          <p className="ds-toolbar__meta">{products.length} productos</p>
        </div>
        <div className="ds-toolbar__end">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              setMermaOpen(false)
              setProductionOpen(true)
            }}
          >
            Producción
          </button>
          <button
            type="button"
            className="btn btn--danger"
            onClick={() => {
              setProductionOpen(false)
              setMermaOpen(true)
            }}
          >
            Merma
          </button>
        </div>
      </div>

      <SoftToast message={message} tone={toastTone} onDismiss={dismissToast} />

      <ProductionSheetModal
        open={productionOpen}
        onClose={() => setProductionOpen(false)}
      />
      <MermaModal open={mermaOpen} onClose={() => setMermaOpen(false)} />

      <section aria-label="Stock físico">
        <h2 className="ds-toolbar__title" style={{ marginBottom: '0.75rem' }}>
          Stock físico
        </h2>
        {products.length === 0 ? (
          <p className="ds-empty">Sin productos.</p>
        ) : (
          <div className="ds-table-wrap">
            <table className="ds-table">
              <thead>
                <tr>
                  <th className="ds-table__thumb-col">Foto</th>
                  <th>Producto</th>
                  <th className="ds-table__num">Precio</th>
                  <th className="ds-table__num">Disponible</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr
                    key={product.id}
                    className="ds-table__row--clickable"
                    onClick={() => openEdit(product)}
                  >
                    <td className="ds-table__thumb-col">
                      <span
                        className="product-thumb"
                        style={{ backgroundImage: `url(${productImage(product)})` }}
                        aria-hidden="true"
                      />
                    </td>
                    <td>{product.name}</td>
                    <td className="ds-table__num">{formatMoney(product.unitPrice)}</td>
                    <td className="ds-table__num">{product.physicalStock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <AdminDrawer
        open={Boolean(form)}
        title={form ? `Editar · ${form.name}` : 'Editar producto'}
        onClose={closeEdit}
        footer={
          form ? (
            <div className="admin-form__actions">
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => setConfirmRemove(true)}
                disabled={saving}
              >
                Eliminar
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => void save(true)}
                disabled={saving}
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          ) : null
        }
      >
        {form ? (
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
            <div className="admin-form__row">
              <label className="field">
                <span className="field__label">Precio</span>
                <input
                  className="field__input"
                  type="number"
                  inputMode="decimal"
                  value={form.unitPrice}
                  onChange={(e) =>
                    setForm({ ...form, unitPrice: Number(e.target.value) })
                  }
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
            <ProductPhotoField
              value={form.photoPath}
              onChange={(photoPath) => setForm({ ...form, photoPath })}
              onError={(msg) => notify(msg, 'error')}
              allowSavedPhotos
            />
          </div>
        ) : null}
      </AdminDrawer>

      <SoftConfirm
        open={confirmRemove}
        danger
        title={`¿Eliminar «${form?.name || 'este producto'}» del inventario?`}
        body="Se oculta del stock y del catálogo."
        confirmLabel="Sí, eliminar"
        onCancel={() => setConfirmRemove(false)}
        onConfirm={() => {
          setConfirmRemove(false)
          void remove()
        }}
      />

      <section aria-label="Mermas registradas" style={{ marginTop: '2rem' }}>
        <h2 className="ds-toolbar__title" style={{ marginBottom: '0.75rem' }}>
          Mermas y salidas
        </h2>
        {mermaRecords.length === 0 ? (
          <p className="ds-empty">Todavía no hay registros de merma.</p>
        ) : (
          <div className="ds-table-wrap">
            <table className="ds-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="ds-table__num">Cantidad</th>
                  <th>Motivo</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {mermaRecords.slice(0, 10).map((record) => (
                  <tr key={record.id}>
                    <td>{record.productName}</td>
                    <td className="ds-table__num">−{record.quantity}</td>
                    <td>{record.reason}</td>
                    <td>{formatTime(record.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-label="Hojas de producción" style={{ marginTop: '2rem' }}>
        <h2 className="ds-toolbar__title" style={{ marginBottom: '0.75rem' }}>
          Hojas de producción
        </h2>
        <ProductionHistory sheets={productionSheets} />
      </section>
    </main>
  )
}
