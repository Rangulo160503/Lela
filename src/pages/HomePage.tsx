import { Link } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { useInventory } from '../features/inventario/InventoryContext'
import { SCENE } from '../data/productVisuals'

export function HomePage() {
  const { user, isAdmin } = useAuth()
  const { serverOnline, openShift, products } = useInventory()
  const stockHint = products.slice(0, 4)

  return (
    <main className="editorial-home">
      <section className="editorial-hero">
        <div className="editorial-hero__copy">
          <p className="editorial-kicker">Operación del día</p>
          <h1 className="editorial-display">
            Hola, {user?.displayName?.split(' ')[0] ?? 'equipo'}
          </h1>
          <p className="editorial-lede">
            Cobra, produce y cierra el turno desde aquí.
          </p>
          <div className="editorial-hero__actions">
            <Link className="btn btn--primary" to="/facturacion">
              Ir a facturar
            </Link>
            <Link className="btn btn--secondary" to="/turnos">
              Turnos y caja
            </Link>
          </div>
          <p className="editorial-meta">
            {serverOnline ? 'Servidor en línea' : 'Servidor no disponible'}
            {openShift
              ? ` · Turno ${openShift.businessDate}`
              : ' · Sin turno abierto'}
          </p>
        </div>
        <figure className="editorial-hero__media">
          <img
            src={SCENE.oven}
            alt=""
            width={960}
            height={720}
            decoding="async"
          />
        </figure>
      </section>

      <section className="editorial-band editorial-band--ink">
        <div className="editorial-band__inner editorial-band__inner--split">
          <div>
            <p className="editorial-kicker editorial-kicker--light">Mostrador</p>
            <h2 className="editorial-title-light">Facturación</h2>
            <p className="editorial-copy-light">
              Catálogo, cobro e impresión en la PC principal.
            </p>
            <Link className="btn-editorial btn-editorial--light" to="/facturacion">
              Abrir punto de venta
            </Link>
          </div>
          <figure className="editorial-band__photo">
            <img src={SCENE.croissant} alt="" decoding="async" />
          </figure>
        </div>
      </section>

      <section className="editorial-band">
        <div className="editorial-band__inner">
          <div className="editorial-row">
            <div className="editorial-row__text">
              <p className="editorial-kicker">Inventario</p>
              <h2 className="editorial-title">En vitrina</h2>
              <p className="editorial-copy">
                Existencias, producción y mermas.
              </p>
              <Link className="text-link" to="/inventario">
                Ver inventario
              </Link>
            </div>
            <ul className="editorial-stock" aria-label="Muestra de stock">
              {stockHint.map((p) => (
                <li key={p.id}>
                  <span>{p.name}</span>
                  <strong>{p.physicalStock}</strong>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="editorial-band editorial-band--wheat">
        <div className="editorial-band__inner editorial-mosaic">
          <Link className="editorial-tile editorial-tile--photo" to="/inventario">
            <img src={SCENE.bread} alt="" decoding="async" />
            <span>
              <strong>Producción</strong>
              <em>Hoja del día</em>
            </span>
          </Link>
          <Link className="editorial-tile" to="/turnos">
            <strong>Turnos</strong>
            <em>Apertura y cierre</em>
          </Link>
          {isAdmin ? (
            <Link className="editorial-tile editorial-tile--accent" to="/admin">
              <strong>Admin</strong>
              <em>Catálogo y control</em>
            </Link>
          ) : (
            <Link className="editorial-tile editorial-tile--photo" to="/facturacion">
              <img src={SCENE.coffee} alt="" decoding="async" />
              <span>
                <strong>Cobrar</strong>
                <em>Nueva venta</em>
              </span>
            </Link>
          )}
        </div>
      </section>
    </main>
  )
}
