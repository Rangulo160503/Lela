import type { PaymentMethod } from './types'

export type PaymentValidation =
  | { ok: true; amountPaid: number; change: number }
  | { ok: false; error: 'missing_method' | 'invalid_amount' | 'insufficient_amount' }

export function validatePayment(
  total: number,
  method: PaymentMethod | null,
  amountRaw: string,
): PaymentValidation {
  if (!method) {
    return { ok: false, error: 'missing_method' }
  }

  const amountPaid = Number(amountRaw)
  if (!Number.isFinite(amountPaid) || amountPaid <= 0) {
    return { ok: false, error: 'invalid_amount' }
  }

  // Efectivo puede dar vuelto; SINPE/tarjeta deben cubrir el total.
  if (amountPaid + 1e-9 < total) {
    return { ok: false, error: 'insufficient_amount' }
  }

  const change = method === 'efectivo' ? Math.max(0, amountPaid - total) : 0
  return { ok: true, amountPaid, change }
}

export type PaymentError =
  | 'missing_method'
  | 'invalid_amount'
  | 'insufficient_amount'

export function paymentErrorMessage(error: PaymentError): string {
  switch (error) {
    case 'missing_method':
      return 'Elige el tipo de pago: Efectivo, SINPE o Tarjeta.'
    case 'invalid_amount':
      return 'Indica un monto válido con el que paga el cliente.'
    case 'insufficient_amount':
      return 'El monto recibido es menor que el total de la factura.'
    default: {
      const _exhaustive: never = error
      return _exhaustive
    }
  }
}
