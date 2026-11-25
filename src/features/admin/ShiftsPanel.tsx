import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../../data/api'
import { formatMoney } from '../../domain/buildProforma'

type ShiftRow = {
  id: string
  businessDate: string
  status: string
  expectedCash?: number
  countedCash?: number
}

type ShiftsPanelProps = {
  shifts: ShiftRow[]
  onSaved: () => void
  onMessage?: (msg: string) => void
}

export function ShiftsPanel({ shifts, onSaved, onMessage }: ShiftsPanelProps) {
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([])
  const [open, setOpen] = useState<{
    id: string
    businessDate: string
    expectedCash?: number | null
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [openingCashInput, setOpeningCashInput] = useState('')
  const [editOpeningInput, setEditOpeningInput] = useState('')

  async function loadMeta() {
    const t = await apiGet<{ ok: true; items: { id: string; name: string }[] }>(
      '/shifts/templates',
    )
    setTemplates(t.items)
    const s = await apiGet<{
      ok: true
      open: {
        id: string
        businessDate: string
        expectedCash?: number | null
      } | null
    }>('/shifts')
    setOpen(s.open)
    setEditOpeningInput(
      s.open?.expectedCash != null && Number.isFinite(s.open.expectedCash)
        ? String(s.open.expectedCash)
        : '',
    )
  }

  useEffect(() => {
    void loadMeta()
  }, [shifts])

  async function openShift(templateId: string, name: string) {
    const raw = openingCashInput.trim()
    const openingCash = raw === '' ? NaN : Number(raw)
    if (!Number.isFinite(openingCash) || openingCash < 0) {
      onMessage?.('Indicá el monto de apertura (efectivo en caja).')
      return
    }
    setBusy(true)
    try {
      const r = await apiPost<{ ok: boolean; error?: string }>('/shifts/open', {
        templateId,
        openingCash,
      })
      if (!r.ok) {
        onMessage?.(
          r.error === 'opening_cash_required'
            ? 'Indicá el monto de apertura (efectivo en caja).'
            : (r.error ?? 'No se pudo abrir el turno'),
        )
        return
      }
      setOpeningCashInput('')
      onMessage?.(`Turno ${name} abierto`)
      onSaved()
      await loadMeta()
    } catch (err) {
      onMessage?.(err instanceof Error ? err.message : 'Error al abrir')
    } finally {
      setBusy(false)
    }
  }

  async function saveOpeningCash() {
    if (!open) return
    const raw = editOpeningInput.trim()
    const openingCash = raw === '' ? NaN : Number(raw)
    if (!Number.isFinite(openingCash) || openingCash < 0) {
      onMessage?.('Indicá el monto de apertura (efectivo en caja).')
      return
    }
    setBusy(true)
    try {
      const r = await apiPost<{ ok: boolean; error?: string }>(
        `/shifts/${open.id}/opening-cash`,
        { openingCash },
      )
      if (!r.ok) {
        onMessage?.(r.error ?? 'No se pudo guardar')
        return
      }
      onMessage?.('Monto de apertura actualizado')
      onSaved()
      await loadMeta()
    } catch (err) {
      onMessage?.(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="admin-panel">
      <div className="ds-toolbar">
        <h2 className="ds-toolbar__title">Turnos</h2>
      </div>

      {!open ? (
        <div className="turno-flow__block" style={{ marginBottom: '1.5rem' }}>
          <h3 className="admin-dash__subtitle">Abrir turno</h3>
          <p className="page__hint">
            Contá el efectivo en caja e indicá el monto. Es obligatorio para
            abrir.
          </p>
          <label className="field" htmlFor="shifts-opening-cash">
            <span className="field__label">Monto de apertura (efectivo)</span>
            <input
              id="shifts-opening-cash"
              className="field__input"
              type="number"
              min={0}
              step={1}
              value={openingCashInput}
              onChange={(e) => setOpeningCashInput(e.target.value)}
              placeholder="0"
              style={{ maxWidth: '14rem' }}
            />
          </label>
          <div className="ds-toolbar__end" style={{ marginTop: '0.75rem' }}>
            {templates.length === 0 ? (
              <p className="page__hint">No hay plantillas de turno.</p>
            ) : (
              templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="btn btn--primary"
                  disabled={busy}
                  onClick={() => void openShift(t.id, t.name)}
                >
                  Abrir {t.name}
                </button>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="turno-flow__block" style={{ marginBottom: '1.5rem' }}>
          <p className="page__hint">
            Turno abierto · {open.businessDate}
            {open.expectedCash != null
              ? ` · fondo ${formatMoney(open.expectedCash)}`
              : ''}
            . El cierre se hace en Cierre.
          </p>
          <div
            className="ds-toolbar__end"
            style={{ marginTop: '0.75rem', gap: '0.75rem', flexWrap: 'wrap' }}
          >
            <label className="field" htmlFor="shifts-edit-opening">
              <span className="field__label">Editar fondo de apertura</span>
              <input
                id="shifts-edit-opening"
                className="field__input"
                type="number"
                min={0}
                step={1}
                value={editOpeningInput}
                onChange={(e) => setEditOpeningInput(e.target.value)}
                style={{ maxWidth: '12rem' }}
              />
            </label>
            <button
              type="button"
              className="btn btn--primary"
              disabled={busy}
              onClick={() => void saveOpeningCash()}
            >
              Guardar monto
            </button>
          </div>
        </div>
      )}

      <h3 className="admin-dash__subtitle">Historial</h3>
      {shifts.length === 0 ? (
        <p className="ds-empty">Sin turnos registrados.</p>
      ) : (
        <div className="ds-table-wrap">
          <table className="ds-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Estado</th>
                <th className="ds-table__num">Esperado</th>
                <th className="ds-table__num">Contado</th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((s) => (
                <tr key={s.id}>
                  <td>{s.businessDate}</td>
                  <td>{s.status}</td>
                  <td className="ds-table__num">
                    {s.expectedCash != null ? formatMoney(s.expectedCash) : '—'}
                  </td>
                  <td className="ds-table__num">
                    {s.countedCash != null ? formatMoney(s.countedCash) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
