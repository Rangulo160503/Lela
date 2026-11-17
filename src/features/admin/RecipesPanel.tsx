import { useState } from 'react'
import { apiPost } from '../../data/api'
import { AdminDrawer } from './AdminDrawer'

type RecipesPanelProps = {
  recipes: { id: string; name: string; version: number }[]
  products: { id: string; name: string }[]
  materials: { id: string; name: string }[]
  onSaved: () => void
}

const emptyForm = {
  productId: '',
  name: '',
  rawMaterialId: '',
  quantity: 1,
}

export function RecipesPanel({
  recipes,
  products,
  materials,
  onSaved,
}: RecipesPanelProps) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)

  return (
    <section className="admin-panel">
      <div className="ds-toolbar">
        <h2 className="ds-toolbar__title">Recetas</h2>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => {
            setForm(emptyForm)
            setOpen(true)
          }}
        >
          Nueva
        </button>
      </div>

      {recipes.length === 0 ? (
        <p className="ds-empty">Sin recetas.</p>
      ) : (
        <div className="ds-table-wrap">
          <table className="ds-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th className="ds-table__num">Versión</th>
              </tr>
            </thead>
            <tbody>
              {recipes.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td className="ds-table__num">v{r.version}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AdminDrawer
        open={open}
        title="Nueva receta"
        onClose={() => setOpen(false)}
        footer={
          <button
            type="button"
            className="btn btn--primary"
            onClick={async () => {
              await apiPost('/recipes', {
                productId: form.productId,
                name: form.name || 'Receta',
                official: true,
                ingredients: [
                  {
                    rawMaterialId: form.rawMaterialId,
                    quantity: form.quantity,
                  },
                ],
              })
              setOpen(false)
              onSaved()
            }}
          >
            Guardar receta
          </button>
        }
      >
        <div className="admin-form">
          <label className="field">
            <span className="field__label">Producto</span>
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
            <span className="field__label">Nombre receta</span>
            <input
              className="field__input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoComplete="off"
            />
          </label>
          <label className="field">
            <span className="field__label">Ingrediente</span>
            <select
              className="field__input"
              value={form.rawMaterialId}
              onChange={(e) => setForm({ ...form, rawMaterialId: e.target.value })}
            >
              <option value="">Elegir ingrediente</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Cantidad</span>
            <input
              className="field__input"
              type="number"
              inputMode="decimal"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
            />
          </label>
        </div>
      </AdminDrawer>
    </section>
  )
}
