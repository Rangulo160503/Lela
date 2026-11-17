import { useEffect } from 'react'
import { SaleForm } from './SaleForm'

type FacturacionModalProps = {
  open: boolean
  onClose: () => void
}

export function FacturacionModal({ open, onClose }: FacturacionModalProps) {
  useEffect(() => {
    if (!open) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="modal-backdrop modal-backdrop--pos"
      role="presentation"
    >
      <div
        className="modal modal--pos"
        role="dialog"
        aria-modal="true"
        aria-labelledby="facturacion-modal-title"
      >
        <SaleForm titleId="facturacion-modal-title" onClose={onClose} />
      </div>
    </div>
  )
}
