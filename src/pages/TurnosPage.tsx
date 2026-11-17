import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../data/api'
import { useInventory } from '../features/inventario/InventoryContext'
import { formatMoney } from '../domain/buildProforma'

export function TurnosPage() {
  const { products, refresh } = useInventory()
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([])
  const [open, setOpen] = useState<{
    id: string
    businessDate: string
    expectedCash?: number
  } | null>(null)
  const [accounts, setAccounts] = useState<{ id: string; name: string; balance: number }[]>(
    [],
  )
  const [countedCash, setCountedCash] = useState(0)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [expense, setExpense] = useState({ description: '', amount: 0, accountId: 'acc-efectivo' })
  const [showExpense, setShowExpense] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function load() {
    const t = await apiGet<{ ok: true; items: { id: string; name: string }[] }>(
      '/shifts/templates',
    )
    setTemplates(t.items)
    const s = await apiGet<{
      ok: true
      open: { id: string; businessDate: string; expectedCash?: number } | null
    }>('/shifts')
    setOpen(s.open)
    const a = await apiGet<{
      ok: true
      items: { id: string; name: string; balance: number }[]
    }>('/accounts')
    setAccounts(a.items)
    const efectivo = a.items.find((x) => x.id === 'acc-efectivo')?.balance ?? 0
    setCountedCash(efectivo)
    setCounts(Object.fromEntries(products.map((p) => [p.id, p.physicalStock])))
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products])

  const efectivoBalance =
    accounts.find((a) => a.id === 'acc-efectivo')?.balance ?? 0

  return (
    <main className="page page--wide page--editorial">
      <header className="module-head module-head--ops">
        <div className="module-head__copy">
          <p className="module-head__kicker ops-hide-mobile">Caja del día</p>
          <h1 className="module-head__title">Turnos</h1>
          <p className="module-head__lede">
            {open
              ? `Turno abierto · ${open.businessDate}`
              : 'Sin turno abierto.'}
          </p>
        </div>
      </header>

      {msg ? <p className="login-form__error">{msg}</p> : null}

      <div className="turno-balance">
        {accounts.map((a) => (
          <div key={a.id} className="turno-balance__item">
            <p className="turno-balance__label">{a.name}</p>
            <p className="turno-balance__value">{formatMoney(a.balance)}</p>
          </div>
        ))}
      </div>

      <div className="turno-state">
        {!open ? (
          <section className="turno-flow">
            <div className="turno-flow__block">
              <h2 className="turno-flow__title">Abrir turno</h2>
              <p className="page__hint">
                La apertura usa el efectivo del cierre anterior como referencia.
              </p>
              <div className="ds-toolbar__end" style={{ marginTop: '0.75rem' }}>
                {templates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="btn btn--primary"
                    onClick={async () => {
                      const r = await apiPost<{ ok: boolean; error?: string }>(
                        '/shifts/open',
                        { templateId: t.id },
                      )
                      setMsg(r.ok ? `Turno ${t.name} abierto` : r.error ?? 'Error')
                      void load()
                    }}
                  >
                    Abrir {t.name}
                  </button>
                ))}
              </div>
            </div>
          </section>
        ) : (
          <section className="turno-flow">
            <div className="turno-flow__block">
              <div className="ds-toolbar">
                <h2 className="turno-flow__title">Actividad del turno</h2>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={() => setShowExpense((v) => !v)}
                >
                  {showExpense ? 'Ocultar gasto' : 'Registrar gasto'}
                </button>
              </div>
              {showExpense ? (
                <div className="admin-form">
                  <input
                    className="field__input"
                    placeholder="Descripción"
                    value={expense.description}
                    onChange={(e) =>
                      setExpense({ ...expense, description: e.target.value })
                    }
                  />
                  <input
                    className="field__input"
                    type="number"
                    value={expense.amount}
                    onChange={(e) =>
                      setExpense({ ...expense, amount: Number(e.target.value) })
                    }
                  />
                  <button
                    type="button"
                    className="btn btn--secondary"
                    onClick={async () => {
                      await apiPost('/expenses', expense)
                      setMsg('Gasto registrado')
                      setShowExpense(false)
                      setExpense({ description: '', amount: 0, accountId: 'acc-efectivo' })
                      void load()
                      void refresh()
                    }}
                  >
                    Guardar gasto
                  </button>
                </div>
              ) : (
                <p className="page__hint">
                  Cobros e inventario se actualizan solos. Usa gasto solo cuando
                  salga efectivo fuera de venta.
                </p>
              )}
            </div>

            <div className="turno-flow__block">
              <h2 className="turno-flow__title">Cerrar turno</h2>
              <p className="page__hint">
                Esperado en caja (sistema): {formatMoney(efectivoBalance)}
              </p>
              <label className="field__label" htmlFor="counted-cash">
                Efectivo contado
              </label>
              <input
                id="counted-cash"
                className="field__input"
                type="number"
                value={countedCash}
                onChange={(e) => setCountedCash(Number(e.target.value))}
              />

              <h3 className="panel__title" style={{ marginTop: '1rem' }}>
                Conteo de productos
              </h3>
              <div className="ds-table-wrap">
                <table className="ds-table">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th className="ds-table__num">Sistema</th>
                      <th className="ds-table__num">Contado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => (
                      <tr key={p.id}>
                        <td>{p.name}</td>
                        <td className="ds-table__num">{p.physicalStock}</td>
                        <td className="ds-table__num">
                          <input
                            className="field__input"
                            style={{
                              maxWidth: '5.5rem',
                              minHeight: '2.35rem',
                              padding: '0.4rem 0.5rem',
                            }}
                            type="number"
                            value={counts[p.id] ?? 0}
                            onChange={(e) =>
                              setCounts({ ...counts, [p.id]: Number(e.target.value) })
                            }
                            aria-label={`Conteo de ${p.name}`}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                type="button"
                className="btn btn--primary"
                style={{ marginTop: '1rem' }}
                onClick={async () => {
                  const r = await apiPost<{ ok: boolean; differences?: number }>(
                    `/shifts/${open.id}/close`,
                    {
                      countedCash,
                      countedInventory: counts,
                      notes: '',
                    },
                  )
                  setMsg(
                    r.ok
                      ? `Cierre guardado. Diferencias reportadas: ${r.differences ?? 0}`
                      : 'No se pudo cerrar',
                  )
                  void load()
                  void refresh()
                }}
              >
                Cerrar turno
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
