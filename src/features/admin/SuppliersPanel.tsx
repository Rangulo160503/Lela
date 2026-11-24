import { useState } from 'react'
import { SoftConfirm } from '../../components/SoftConfirm'
import { apiPost } from '../../data/api'
import { AdminDrawer } from './AdminDrawer'

type SupplierRow = {
  id: string
  name: string
  phone: string
  active?: number | boolean
}

type SuppliersPanelProps = {
  suppliers: SupplierRow[]
  onSaved: () => void
  onMessage?: (msg: string) => void
}

type SupplierForm = {
  id?: string
  name: string
  phone: string
}

const emptyForm: SupplierForm = { name: '', phone: '' }

function isActive(s: SupplierRow): boolean {
  return s.active !== 0 && s.active !== false
}

export function SuppliersPanel({ suppliers, onSaved, onMessage }: SuppliersPanelProps) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<SupplierForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const editing = Boolean(form.id)
  const visible = suppliers.filter(isActive)

  function openCreate() {
    setForm(emptyForm)
    setOpen(true)
  }

  function openEdit(s: SupplierRow) {
    setForm({ id: s.id, name: s.name, phone: s.phone ?? '' })
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
    setSaving(true)
    try {
      await apiPost('/suppliers', {
        id: form.id,
        name: form.name.trim(),
        phone: form.phone.trim(),
        active,
      })
      onMessage?.(
        !active ? 'Proveedor eliminado' : editing ? 'Proveedor actualizado' : 'Proveedor guardado',
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
        <h2 className="ds-toolbar__title">Proveedores</h2>
        <button type="button" className="btn btn--primary" onClick={openCreate}>
          Nuevo
        </button>
      </div>

      {visible.length === 0 ? (
        <p className="ds-empty">Sin proveedores.</p>
      ) : (
        <div className="ds-table-wrap">
          <table className="ds-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Teléfono</th>
                <th className="ds-table__action"> </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((s) => (
                <tr
                  key={s.id}
                  className="ds-table__row--clickable"
                  onClick={() => openEdit(s)}
                >
                  <td>{s.name}</td>
                  <td>{s.phone}</td>
                  <td className="ds-table__action">
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        openEdit(s)
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
        title={editing ? 'Editar proveedor' : 'Nuevo proveedor'}
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
            <span className="field__label">Teléfono</span>
            <input
              className="field__input"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              autoComplete="off"
              inputMode="tel"
            />
          </label>
        </div>
      </AdminDrawer>

      <SoftConfirm
        open={confirmRemove}
        danger
        title={`¿Eliminar «${form.name || 'este proveedor'}»?`}
        body="Deja de aparecer en la lista de proveedores."
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
