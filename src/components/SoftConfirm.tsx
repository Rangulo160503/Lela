type SoftConfirmProps = {
  open: boolean
  title: string
  body?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** Confirmación con el mismo lenguaje visual del sistema (no window.confirm). */
export function SoftConfirm({
  open,
  title,
  body,
  confirmLabel = 'Sí, continuar',
  cancelLabel = 'Cancelar',
  danger,
  onConfirm,
  onCancel,
}: SoftConfirmProps) {
  if (!open) return null

  return (
    <div className="modal-backdrop soft-confirm-backdrop" role="presentation">
      <div
        className={`modal modal--opaque soft-confirm${danger ? ' soft-confirm--danger' : ''}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="soft-confirm-title"
      >
        <h2 id="soft-confirm-title" className="soft-confirm__title">
          {title}
        </h2>
        {body ? <p className="soft-confirm__body">{body}</p> : null}
        <div className="soft-confirm__actions">
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={danger ? 'btn btn--danger' : 'btn btn--primary'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
