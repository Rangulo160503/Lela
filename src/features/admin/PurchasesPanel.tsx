import { useState } from 'react'
import { apiPost } from '../../data/api'
import { formatMoney } from '../../domain/buildProforma'
import { AdminDrawer } from './AdminDrawer'

type PurchasesPanelProps = {
  purchases: { id: string; total: number; paidAmount: number }[]
  suppliers: { id: string; name: string }[]
  materials: { id: string; name: string }[]
  onSaved: () => void
}

const emptyForm = {
  supplierId: '',
  rawMaterialId: '',
  name: '',
  quantity: 1,
  unitCost: 0,
  payNow: 0,
  paymentAccount: 'acc-efectivo',
}

export function PurchasesPanel({
  purchases,
  suppliers,
  materials,
  onSaved,
}: PurchasesPanelProps) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)

  return (
    <section className="admin-panel">
      <div className="ds-toolbar">
        <h2 className="ds-toolbar__title">Facturas</h2>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => {
            setForm(emptyForm)
            setOpen(true)
          }}
        >
          Nueva factura
        </button>
      </div>
      <p className="page__hint">
        Facturas de proveedor (materia prima). Captura manual.
      </p>

      {purchases.length === 0 ? (
        <p className="ds-empty">Sin facturas registradas.</p>
      ) : (
        <div className="ds-table-wrap">
          <table className="ds-table">
            <thead>
              <tr>
                <th>Id</th>
                <th className="ds-table__num">Total</th>
                <th className="ds-table__num">Pagado</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => (
                <tr key={p.id}>
                  <td>{p.id.slice(0, 8)}</td>
                  <td className="ds-table__num">{formatMoney(p.total)}</td>
                  <td className="ds-table__num">{formatMoney(p.paidAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AdminDrawer
        open={open}
        title="Registrar factura"
        wide
        onClose={() => setOpen(false)}
        footer={
          <button
            type="button"
            className="btn btn--primary"
            onClick={async () => {
              await apiPost('/purchases', {
                supplierId: form.supplierId || undefined,
                paymentAccount: form.paymentAccount,
                payNow: form.payNow,
                lines: [
                  {
                    rawMaterialId: form.rawMaterialId,
                    name: form.name,
                    quantity: form.quantity,
                    unitCost: form.unitCost,
                  },
                ],
              })
              setOpen(false)
              onSaved()
            }}
          >
            Registrar factura
          </button>
        }
      >
        <div className="admin-form">
          <label className="field">
            <span className="field__label">Proveedor</span>
            <select
              className="field__input"
              value={form.supplierId}
              onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
            >
              <option value="">Elegir proveedor</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Materia prima</span>
            <select
              className="field__input"
              value={form.rawMaterialId}
              onChange={(e) => {
                const m = materials.find((x) => x.id === e.target.value)
                setForm({
                  ...form,
                  rawMaterialId: e.target.value,
                  name: m?.name ?? '',
                })
              }}
            >
              <option value="">Elegir materia</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <div className="admin-form__row">
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
            <label className="field">
              <span className="field__label">Costo unitario</span>
              <input
                className="field__input"
                type="number"
                inputMode="decimal"
                value={form.unitCost}
                onChange={(e) => setForm({ ...form, unitCost: Number(e.target.value) })}
              />
            </label>
          </div>
          <label className="field">
            <span className="field__label">Pagar ahora</span>
            <input
              className="field__input"
              type="number"
              inputMode="decimal"
              value={form.payNow}
              onChange={(e) => setForm({ ...form, payNow: Number(e.target.value) })}
            />
          </label>
        </div>
      </AdminDrawer>
    </section>
  )
}
