import type { ReactNode } from 'react'
import { useEffect } from 'react'

type AdminDrawerProps = {
  open: boolean
  title: string
  onClose: () => void
  wide?: boolean
  children: ReactNode
  footer?: ReactNode
}

export function AdminDrawer({
  open,
  title,
  onClose,
  wide,
  children,
  footer,
}: AdminDrawerProps) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      <div className="ds-drawer-backdrop" role="presentation" onClick={onClose} />
      <aside
        className={`ds-drawer${wide ? ' ds-drawer--wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="ds-drawer__header">
          <h2 className="ds-drawer__title">{title}</h2>
          <button type="button" className="ds-drawer__close" onClick={onClose}>
            Cerrar
          </button>
        </header>
        <div className="ds-drawer__body">{children}</div>
        {footer ? <div className="ds-drawer__footer">{footer}</div> : null}
      </aside>
    </>
  )
}
