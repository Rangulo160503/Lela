import { useInventory } from '../features/inventario/InventoryContext'

export function ServerStatusBanner() {
  const { loading, serverOnline, serverError, refresh } = useInventory()

  if (loading || serverOnline) return null

  return (
    <div className="server-banner" role="alert">
      <p>{serverError ?? 'Servidor no disponible.'}</p>
      <button type="button" className="server-banner__btn" onClick={() => void refresh()}>
        Reintentar
      </button>
    </div>
  )
}
