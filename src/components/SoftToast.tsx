import { useEffect } from 'react'

type SoftToastProps = {
  message: string | null
  tone?: 'ok' | 'warn' | 'error'
  onDismiss: () => void
  ms?: number
}

/** Aviso breve al estilo Lela (crema/terracota), no alerta de sistema. */
export function SoftToast({
  message,
  tone = 'ok',
  onDismiss,
  ms = 4200,
}: SoftToastProps) {
  useEffect(() => {
    if (!message) return
    const t = window.setTimeout(onDismiss, ms)
    return () => window.clearTimeout(t)
  }, [message, ms, onDismiss])

  if (!message) return null

  return (
    <div className="soft-toast-host" aria-live="polite">
      <div className={`soft-toast soft-toast--${tone}`} role="status">
        <p className="soft-toast__text">{message}</p>
        <button
          type="button"
          className="soft-toast__close"
          onClick={onDismiss}
          aria-label="Cerrar"
        >
          Cerrar
        </button>
      </div>
    </div>
  )
}
