import { formatMoney } from '../../domain/buildProforma'
import { productImage } from '../../data/productVisuals'
import type { Product } from '../../domain/types'

type ProductCatalogProps = {
  products: Product[]
  searchQuery: string
  onSearchChange: (value: string) => void
  quantities: Record<string, number>
  onAddProduct: (productId: string) => void
}

export function ProductCatalog({
  products,
  searchQuery,
  onSearchChange,
  quantities,
  onAddProduct,
}: ProductCatalogProps) {
  return (
    <section className="catalog catalog--editorial" aria-label="Catálogo de productos">
      <div className="catalog__search">
        <label className="field__label" htmlFor="catalog-search">
          Buscar producto
        </label>
        <input
          id="catalog-search"
          className="field__input"
          type="search"
          placeholder="Ej. pan, concha, café…"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          autoComplete="off"
        />
      </div>

      {products.length === 0 ? (
        <p className="page__hint">No hay coincidencias.</p>
      ) : (
        <ul className="catalog__grid" aria-label="Resultados">
          {products.map((product) => {
            const inCart = quantities[product.id] ?? 0
            const outOfStock = product.physicalStock <= 0
            const atMax = inCart >= product.physicalStock

            return (
              <li key={product.id}>
                <button
                  type="button"
                  className={
                    inCart > 0
                      ? 'catalog-card catalog-card--selected'
                      : 'catalog-card'
                  }
                  disabled={outOfStock || atMax}
                  onClick={() => onAddProduct(product.id)}
                >
                  <span
                    className="catalog-card__media"
                    style={{
                      backgroundImage: `url(${productImage(product)})`,
                    }}
                    aria-hidden="true"
                  />
                  <span className="catalog-card__body">
                    <span className="catalog-card__name">{product.name}</span>
                    <span className="catalog-card__meta">
                      {outOfStock
                        ? 'Sin inventario'
                        : `${formatMoney(product.unitPrice)} · ${product.physicalStock} disp.`}
                    </span>
                    <span className="catalog-card__action">
                      {inCart > 0 ? `En factura: ${inCart}` : 'Agregar'}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
