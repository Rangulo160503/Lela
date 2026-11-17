import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { MessageModal } from '../../components/MessageModal'
import { buildProforma, formatMoney } from '../../domain/buildProforma'
import {
  paymentErrorMessage,
  validatePayment,
} from '../../domain/payment'
import { searchProducts } from '../../domain/searchProducts'
import type {
  PaymentMethod,
  RegisteredSale,
  SaleError,
} from '../../domain/types'
import { PAYMENT_METHOD_LABELS } from '../../domain/types'
import { useInventory } from '../inventario/InventoryContext'
import { CompletedSalePanel } from './CompletedSalePanel'
import { InvoicePreview } from './InvoicePreview'
import { ProductCatalog } from './ProductCatalog'

type Step = 'catalog' | 'preview'

type SaleFormProps = {
  titleId?: string
  onClose?: () => void
}

function errorMessage(
  error: SaleError | 'empty_sale',
  productName?: string,
): string {
  const where = productName ? ` (${productName})` : ''
  switch (error) {
    case 'empty_sale':
      return 'Agrega al menos un producto a la factura.'
    case 'invalid_quantity':
      return `La cantidad debe ser un número entero positivo${where}.`
    case 'insufficient_stock':
      return `No hay suficiente inventario${where}.`
    case 'out_of_stock':
      return `No hay inventario disponible${where}.`
  }
}

export function SaleForm({ titleId = 'sale-form-title', onClose }: SaleFormProps) {
  const { products, sellLines } = useInventory()
  const [step, setStep] = useState<Step>('catalog')
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null)
  const [amountPaidText, setAmountPaidText] = useState('')
  const [alertMessage, setAlertMessage] = useState<string | null>(null)
  const [completedSale, setCompletedSale] = useState<RegisteredSale | null>(null)
  const [headerCtaReady, setHeaderCtaReady] = useState(true)
  const ctaReadyTimer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (ctaReadyTimer.current !== null) {
        window.clearTimeout(ctaReadyTimer.current)
      }
    }
  }, [])

  const filteredProducts = useMemo(
    () => searchProducts(products, searchQuery),
    [products, searchQuery],
  )

  const proforma = buildProforma(products, quantities)
  const hasItems = proforma.lines.length > 0
  const itemCount = proforma.lines.reduce((sum, line) => sum + line.quantity, 0)

  const previewChange =
    paymentMethod === 'efectivo' && Number(amountPaidText) > 0
      ? Math.max(0, Number(amountPaidText) - proforma.total)
      : 0

  function addProduct(productId: string) {
    const product = products.find((p) => p.id === productId)
    if (!product || product.physicalStock <= 0) return

    setQuantities((prev) => {
      const current = prev[productId] ?? 0
      if (current >= product.physicalStock) return prev
      return { ...prev, [productId]: current + 1 }
    })
  }

  function decreaseLine(productId: string) {
    setQuantities((prev) => {
      const current = prev[productId] ?? 0
      if (current <= 1) {
        const next = { ...prev }
        delete next[productId]
        return next
      }
      return { ...prev, [productId]: current - 1 }
    })
  }

  function increaseLine(productId: string) {
    const product = products.find((p) => p.id === productId)
    if (!product) return

    setQuantities((prev) => {
      const current = prev[productId] ?? 0
      if (current >= product.physicalStock) return prev
      return { ...prev, [productId]: current + 1 }
    })
  }

  function removeLine(productId: string) {
    setQuantities((prev) => {
      const next = { ...prev }
      delete next[productId]
      return next
    })
  }

  function setLineQuantity(productId: string, quantity: number) {
    const product = products.find((p) => p.id === productId)
    if (!product) return

    if (!Number.isInteger(quantity) || quantity <= 0) {
      removeLine(productId)
      return
    }

    const capped = Math.min(quantity, product.physicalStock)
    setQuantities((prev) => ({ ...prev, [productId]: capped }))
  }

  function armHeaderCta() {
    setHeaderCtaReady(false)
    if (ctaReadyTimer.current !== null) {
      window.clearTimeout(ctaReadyTimer.current)
    }
    ctaReadyTimer.current = window.setTimeout(() => {
      setHeaderCtaReady(true)
      ctaReadyTimer.current = null
    }, 450)
  }

  function goToPreview() {
    if (!hasItems) {
      setAlertMessage('Agrega al menos un producto antes de cobrar.')
      return
    }
    setAlertMessage(null)
    setPaymentMethod(null)
    setAmountPaidText('')
    armHeaderCta()
    setStep('preview')
  }

  async function registerSale() {
    if (!headerCtaReady) return

    if (!hasItems) {
      setAlertMessage('Agrega al menos un producto a la factura.')
      return
    }

    const payment = validatePayment(proforma.total, paymentMethod, amountPaidText)
    if (!payment.ok) {
      setAlertMessage(paymentErrorMessage(payment.error))
      setStep('preview')
      return
    }

    const lines = Object.entries(quantities).map(([productId, quantity]) => ({
      productId,
      quantity,
    }))

    try {
      const result = await sellLines(lines, {
        paymentMethod: paymentMethod!,
        amountPaid: payment.amountPaid,
        change: payment.change,
      })
      if (!result.ok) {
        const name = result.productId
          ? products.find((p) => p.id === result.productId)?.name
          : undefined
        if (
          result.error === 'missing_method' ||
          result.error === 'invalid_amount' ||
          result.error === 'insufficient_amount'
        ) {
          setAlertMessage(paymentErrorMessage(result.error))
        } else {
          setAlertMessage(errorMessage(result.error, name))
        }
        return
      }

      setQuantities({})
      setSearchQuery('')
      setPaymentMethod(null)
      setAmountPaidText('')
      setStep('catalog')
      setHeaderCtaReady(true)
      setCompletedSale(result.sale)
    } catch {
      setAlertMessage(
        'No se pudo contactar al servidor. Revisa que esté encendido en la computadora principal.',
      )
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
  }

  const cartPane = (
    <>
      <div className="pos-cart__section">
        <InvoicePreview
          proforma={proforma}
          onDecrease={decreaseLine}
          onIncrease={increaseLine}
          onRemove={removeLine}
          onSetQuantity={setLineQuantity}
          maxQuantityFor={(productId) =>
            products.find((p) => p.id === productId)?.physicalStock ?? 0
          }
        />
      </div>

      <div className="pos-cart__section">
        <section aria-labelledby="payment-title">
          <h3 id="payment-title" className="panel__title">
            Tipo de pago
          </h3>
          <div className="payment-box__methods">
            {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map(
              (method) => (
                <button
                  key={method}
                  type="button"
                  className={
                    paymentMethod === method
                      ? 'payment-box__method payment-box__method--active'
                      : 'payment-box__method'
                  }
                  onClick={() => setPaymentMethod(method)}
                >
                  {PAYMENT_METHOD_LABELS[method]}
                </button>
              ),
            )}
          </div>

          <div className="field" style={{ marginTop: '0.75rem' }}>
            <label className="field__label" htmlFor="amount-paid">
              Monto con el que paga
            </label>
            <input
              id="amount-paid"
              className="field__input"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              placeholder="0.00"
              value={amountPaidText}
              onChange={(e) => setAmountPaidText(e.target.value)}
            />
          </div>

          {paymentMethod === 'efectivo' && Number(amountPaidText) > 0 ? (
            <p className="payment-box__change">
              Vuelto: <strong>{formatMoney(previewChange)}</strong>
            </p>
          ) : null}
        </section>
      </div>
    </>
  )

  return (
    <div className="pos-shell">
      <header className="pos-shell__header">
        <div className="pos-shell__heading">
          <h2 id={titleId} className="pos-shell__title">
            Nueva venta
          </h2>
          <p className="pos-shell__meta">
            {hasItems
              ? `${itemCount} ítems · ${formatMoney(proforma.total)}`
              : 'Catálogo y cobro'}
          </p>
        </div>
        <div className="module-head__actions">
          <button
            type="button"
            className="btn btn--ghost btn--sm pos-mobile-only"
            onClick={() => {
              if (step === 'catalog') goToPreview()
              else setStep('catalog')
            }}
            disabled={step === 'catalog' && !hasItems}
          >
            {step === 'catalog' ? 'Ver carrito' : 'Catálogo'}
          </button>
          <button
            type="button"
            className="btn btn--primary btn--sm pos-mobile-only"
            disabled={!headerCtaReady || (step === 'catalog' ? !hasItems : false)}
            onClick={() => {
              if (step === 'catalog') goToPreview()
              else void registerSale()
            }}
          >
            {step === 'catalog' ? 'Cobrar' : 'Registrar venta'}
          </button>
          <button
            type="button"
            className="btn btn--primary btn--sm pos-desktop-only"
            disabled={!headerCtaReady || !hasItems}
            onClick={() => void registerSale()}
          >
            Registrar venta
          </button>
          {onClose ? (
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={onClose}
            >
              Cerrar
            </button>
          ) : null}
        </div>
      </header>

      <form
        id="sale-form"
        className="pos-shell__body sale-form"
        onSubmit={handleSubmit}
      >
        <div
          className={`pos-pane${
            step !== 'catalog' ? ' pos-pane--step-hidden' : ''
          }`}
        >
          <ProductCatalog
            products={filteredProducts}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            quantities={quantities}
            onAddProduct={addProduct}
          />
        </div>

        <div
          className={`pos-pane pos-pane--cart${
            step !== 'preview' ? ' pos-pane--step-hidden' : ''
          } pos-pane--hidden-mobile`}
        >
          {cartPane}
          <div className="pos-cart__section pos-desktop-only">
            <button
              type="button"
              className="btn btn--primary btn--block"
              disabled={!headerCtaReady || !hasItems}
              onClick={() => void registerSale()}
            >
              Registrar venta
            </button>
          </div>
        </div>

        {step === 'preview' ? (
          <div className="pos-pane pos-pane--cart pos-mobile-only">
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => setStep('catalog')}
            >
              ← Volver al catálogo
            </button>
            {cartPane}
            <div className="pos-cart__section">
              <button
                type="button"
                className="btn btn--primary btn--block"
                disabled={!headerCtaReady}
                onClick={() => void registerSale()}
              >
                Registrar venta
              </button>
            </div>
          </div>
        ) : null}
      </form>

      <MessageModal
        open={Boolean(alertMessage)}
        variant="error"
        title="No se pudo continuar"
        body={alertMessage ?? undefined}
        confirmLabel="Entendido"
        onConfirm={() => setAlertMessage(null)}
      />

      {completedSale ? (
        <CompletedSalePanel
          sale={completedSale}
          onNewSale={() => setCompletedSale(null)}
        />
      ) : null}
    </div>
  )
}
