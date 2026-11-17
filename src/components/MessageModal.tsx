import type { ReactNode } from 'react'

type MessageModalProps = {
  open: boolean
  title: string
  body?: string
  variant?: 'info' | 'success' | 'error'
  confirmLabel?: string
  onConfirm: () => void
  secondaryLabel?: string
  onSecondary?: () => void
  children?: ReactNode
}

export function MessageModal({
  open,
  title,
  body,
  variant = 'info',
  confirmLabel = 'Entendido',
  onConfirm,
  secondaryLabel,
  onSecondary,
  children,
}: MessageModalProps) {
  if (!open) return null

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className={`modal modal--opaque message-modal message-modal--${variant}${
          secondaryLabel ? ' message-modal--wide' : ''
        }`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="message-modal-title"
        aria-describedby={body ? 'message-modal-body' : undefined}
      >
        <div className="no-print">
          <h2 id="message-modal-title" className="message-modal__title">
            {title}
          </h2>
          {body ? (
            <p id="message-modal-body" className="message-modal__body">
              {body}
            </p>
          ) : null}
        </div>

        {children}

        <div className="modal__actions no-print">
          {secondaryLabel && onSecondary ? (
            <button
              type="button"
              className="btn btn--secondary message-modal__btn"
              onClick={onSecondary}
            >
              {secondaryLabel}
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn--primary message-modal__btn"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
