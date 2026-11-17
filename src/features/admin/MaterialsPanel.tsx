import { useState } from 'react'
import { apiPost } from '../../data/api'
import { AdminDrawer } from './AdminDrawer'

type MaterialRow = { id: string; name: string; unit: string; stock: number }

type MaterialsPanelProps = {
  materials: MaterialRow[]
  onSaved: () => void
}

const emptyForm = { name: '', unit: 'kg', stock: 0, avgCost: 0 }

export function MaterialsPanel({ materials, onSaved }: MaterialsPanelProps) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)

  return (
    <section className="admin-panel">
      <div className="ds-toolbar">
        <h2 className="ds-toolbar__title">Materia prima</h2>
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

      {materials.length === 0 ? (
        <p className="ds-empty">Sin materia prima.</p>
      ) : (
        <div className="ds-table-wrap">
          <table className="ds-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Unidad</th>
                <th className="ds-table__num">Stock</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((m) => (
                <tr key={m.id}>
                  <td>{m.name}</td>
                  <td>{m.unit}</td>
                  <td className="ds-table__num">{m.stock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AdminDrawer
        open={open}
        title="Nueva materia prima"
        onClose={() => setOpen(false)}
        footer={
          <button
            type="button"
            className="btn btn--primary"
            onClick={async () => {
              await apiPost('/raw-materials', form)
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
            <span className="field__label">Unidad</span>
            <input
              className="field__input"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              autoComplete="off"
            />
          </label>
          <label className="field">
            <span className="field__label">Stock</span>
            <input
              className="field__input"
              type="number"
              inputMode="decimal"
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
            />
          </label>
        </div>
      </AdminDrawer>
    </section>
  )
}
