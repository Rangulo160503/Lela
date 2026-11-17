import { useState } from 'react'
import { apiPost } from '../../data/api'
import { formatMoney } from '../../domain/buildProforma'
import { AdminDrawer } from './AdminDrawer'

type PromosPanelProps = {
  promos: { id: string; name: string; price: number }[]
  products: { id: string; name: string }[]
  onSaved: () => void
}

const emptyForm = {
  name: '',
  kind: 'combo',
  price: 0,
  productId: '',
  quantity: 1,
}

export function PromosPanel({ promos, products, onSaved }: PromosPanelProps) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)

  return (
    <section className="admin-panel">
      <div className="ds-toolbar">
        <h2 className="ds-toolbar__title">Combos</h2>
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

      {promos.length === 0 ? (
        <p className="ds-empty">Sin combos.</p>
      ) : (
        <div className="ds-table-wrap">
          <table className="ds-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th className="ds-table__num">Precio</th>
              </tr>
            </thead>
            <tbody>
              {promos.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td className="ds-table__num">{formatMoney(p.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AdminDrawer
        open={open}
        title="Nuevo combo"
        onClose={() => setOpen(false)}
        footer={
          <button
            type="button"
            className="btn btn--primary"
            onClick={async () => {
              await apiPost('/promos', {
                name: form.name,
                kind: form.kind,
                price: form.price,
                components: [
                  {
                    productId: form.productId,
                    quantity: form.quantity,
                    substitutable: true,
                  },
                ],
              })
              setOpen(false)
              onSaved()
            }}
          >
            Guardar combo
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
        </div>
      </AdminDrawer>
    </section>
  )
}
