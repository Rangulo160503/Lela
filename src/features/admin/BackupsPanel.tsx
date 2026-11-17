import { apiPost } from '../../data/api'

type BackupRow = {
  id: string
  path: string
  createdAt: string
  kind: string
}

type BackupsPanelProps = {
  backups: BackupRow[]
  onSaved: () => void
  onMessage: (msg: string) => void
}

export function BackupsPanel({ backups, onSaved, onMessage }: BackupsPanelProps) {
  return (
    <section className="admin-panel">
      <div className="ds-toolbar">
        <h2 className="ds-toolbar__title">Respaldos</h2>
        <button
          type="button"
          className="btn btn--primary"
          onClick={async () => {
            await apiPost('/backups', { note: 'manual' })
            onSaved()
          }}
        >
          Crear respaldo
        </button>
      </div>

      {backups.length === 0 ? (
        <p className="ds-empty">Sin respaldos aún.</p>
      ) : (
        <div className="ds-table-wrap">
          <table className="ds-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th className="ds-table__actions">Acción</th>
              </tr>
            </thead>
            <tbody>
              {backups.map((b) => (
                <tr key={b.id}>
                  <td>{b.createdAt}</td>
                  <td>{b.kind}</td>
                  <td className="ds-table__actions">
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={async () => {
                        if (
                          !confirm(
                            'Esto restaurará la base. Se guarda un respaldo previo automáticamente. ¿Continuar?',
                          )
                        ) {
                          return
                        }
                        await apiPost('/backups/restore', { path: b.path })
                        onMessage('Base restaurada. Recarga la página.')
                      }}
                    >
                      Restaurar
                    </button>
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
