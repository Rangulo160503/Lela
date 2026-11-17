import { useState } from 'react'
import { apiPost } from '../../data/api'
import { AdminDrawer } from './AdminDrawer'

type SuppliersPanelProps = {
  suppliers: { id: string; name: string; phone: string }[]
  onSaved: () => void
}

const emptyForm = { name: '', phone: '' }

export function SuppliersPanel({ suppliers, onSaved }: SuppliersPanelProps) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)

  return (
    <section className="admin-panel">
      <div className="ds-toolbar">
        <h2 className="ds-toolbar__title">Proveedores</h2>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => {
            setForm(emptyForm)
            setOpen(true)
          }}
        >
          Nuevo
        </button>
      </div>

      {suppliers.length === 0 ? (
        <p className="ds-empty">Sin proveedores.</p>
      ) : (
        <div className="ds-table-wrap">
          <table className="ds-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Teléfono</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.phone}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AdminDrawer
        open={open}
        title="Nuevo proveedor"
        onClose={() => setOpen(false)}
        footer={
          <button
            type="button"
            className="btn btn--primary"
            onClick={async () => {
              await apiPost('/suppliers', form)
              setOpen(false)
              onSaved()
            }}
          >
            Guardar
          </button>
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
              inputMode="tel"
              autoComplete="tel"
            />
          </label>
        </div>
      </AdminDrawer>
    </section>
  )
}
