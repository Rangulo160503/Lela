import { apiPost } from '../../data/api'

type Proposal = {
  id: string
  title: string
  status: string
  items: { id: string; label: string; status: string }[]
}

type ProposalsPanelProps = {
  proposals: Proposal[]
  onSaved: () => void
}

export function ProposalsPanel({ proposals, onSaved }: ProposalsPanelProps) {
  return (
    <section className="admin-panel">
      <div className="ds-toolbar">
        <h2 className="ds-toolbar__title">Aprobaciones</h2>
      </div>

      {proposals.length === 0 ? (
        <p className="ds-empty">No hay propuestas pendientes.</p>
      ) : (
        <div>
          {proposals.map((p) => (
            <article key={p.id} className="proposal-row">
              <h3 className="proposal-row__title">
                {p.title} · {p.status}
              </h3>
              <ul className="proposal-row__items">
                {p.items.map((i) => (
                  <li key={i.id}>
                    {i.label} ({i.status})
                  </li>
                ))}
              </ul>
              <div className="proposal-row__actions">
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  onClick={async () => {
                    await apiPost(`/proposals/${p.id}/review`, {
                      decisions: p.items.map((i) => ({
                        itemId: i.id,
                        status: 'approved',
                      })),
                    })
                    onSaved()
                  }}
                >
                  Aprobar todo
                </button>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={async () => {
                    await apiPost(`/proposals/${p.id}/review`, {
                      decisions: p.items.map((i) => ({
                        itemId: i.id,
                        status: 'rejected',
                      })),
                    })
                    onSaved()
                  }}
                >
                  Rechazar
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
