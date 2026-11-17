import { describe, expect, it } from 'vitest'
import { validatePayment } from '../payment.js'
import { registerSale } from '../registerSale.js'
import { registerSaleLines } from '../registerSaleLines.js'
import { registerMerma } from '../registerMerma.js'
import { buildProductionDraft } from '../buildProductionDraft.js'
import { buildProforma } from '../buildProforma.js'
import type { Product } from '../types.js'

const products: Product[] = [
  { id: 'a', name: 'Pan', physicalStock: 10, unitPrice: 15 },
  { id: 'b', name: 'Concha', physicalStock: 5, unitPrice: 12 },
]

describe('facturación', () => {
  it('vende varios productos y baja stock atómicamente', () => {
    const result = registerSaleLines(products, [
      { productId: 'a', quantity: 2 },
      { productId: 'b', quantity: 1 },
    ])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.nextProducts.find((p) => p.id === 'a')?.physicalStock).toBe(8)
    expect(result.nextProducts.find((p) => p.id === 'b')?.physicalStock).toBe(4)
  })

  it('rechaza inventario insuficiente sin cambios parciales', () => {
    const result = registerSaleLines(products, [
      { productId: 'a', quantity: 2 },
      { productId: 'b', quantity: 9 },
    ])
    expect(result.ok).toBe(false)
  })

  it('calcula vuelto en efectivo', () => {
    const proforma = buildProforma(products, { a: 2 })
    const paid = validatePayment(proforma.total, 'efectivo', 50)
    expect(paid.ok).toBe(true)
    if (!paid.ok) return
    expect(paid.change).toBe(20)
  })

  it('exige monto suficiente en SINPE', () => {
    const paid = validatePayment(30, 'sinpe', 20)
    expect(paid.ok).toBe(false)
  })

  it('rechaza cantidad inválida', () => {
    expect(registerSale(10, 0).ok).toBe(false)
  })
})

describe('inventario / producción / merma', () => {
  it('registra merma', () => {
    const result = registerMerma(products, 'a', 3)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.nextProducts[0].physicalStock).toBe(7)
  })

  it('sugiere producción = max(0, sold - stock)', () => {
    const draft = buildProductionDraft(
      products,
      [
        {
          id: 's1',
          createdAt: '2026-01-02T00:00:00.000Z',
          lines: [
            {
              productId: 'a',
              name: 'Pan',
              quantity: 12,
              unitPrice: 15,
              subtotal: 180,
            },
          ],
          total: 180,
          paymentMethod: 'efectivo',
          amountPaid: 180,
          change: 0,
        },
      ],
      null,
    )
    const pan = draft.find((d) => d.productId === 'a')
    expect(pan?.quantity).toBe(2)
  })
})
