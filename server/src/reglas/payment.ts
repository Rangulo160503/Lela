import type { PaymentMethod } from './types.js'

export type PaymentValidation =
  | { ok: true; amountPaid: number; change: number }
  | {
      ok: false
      error: 'missing_method' | 'invalid_amount' | 'insufficient_amount'
    }

export function validatePayment(
  total: number,
  method: PaymentMethod | null,
  amountPaid: number,
): PaymentValidation {
  if (!method) {
    return { ok: false, error: 'missing_method' }
  }
  if (!Number.isFinite(amountPaid) || amountPaid <= 0) {
    return { ok: false, error: 'invalid_amount' }
  }
  if (amountPaid + 1e-9 < total) {
    return { ok: false, error: 'insufficient_amount' }
  }
  const change = method === 'efectivo' ? Math.max(0, amountPaid - total) : 0
  return { ok: true, amountPaid, change }
}
