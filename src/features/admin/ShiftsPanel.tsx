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
  const [open, setOpen] = useState<{ id: string; businessDate: string } | null>(
    null,
  )
  const [busy, setBusy] = useState(false)

  async function loadMeta() {
    const t = await apiGet<{ ok: true; items: { id: string; name: string }[] }>(
      '/shifts/templates',
    )
    setTemplates(t.items)
    const s = await apiGet<{
      ok: true
      open: { id: string; businessDate: string } | null
    }>('/shifts')
    setOpen(s.open)
  }

  useEffect(() => {
    void loadMeta()
  }, [shifts])

  async function openShift(templateId: string, name: string) {
    setBusy(true)
    try {
      const r = await apiPost<{ ok: boolean; error?: string }>('/shifts/open', {
        templateId,
      })
      if (!r.ok) {
        onMessage?.(r.error ?? 'No se pudo abrir el turno')
        return
      }
      onMessage?.(`Turno ${name} abierto`)
      onSaved()
      await loadMeta()
    } catch (err) {
      onMessage?.(err instanceof Error ? err.message : 'Error al abrir')
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
            La apertura usa el efectivo del cierre anterior como referencia.
          </p>
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
        <p className="page__hint" style={{ marginBottom: '1.25rem' }}>
          Turno abierto · {open.businessDate}. El cierre se hace en Dashboard.
        </p>
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
