import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { BrandMark } from '../components/BrandMark'
import { SCENE } from '../data/productVisuals'

export function LoginPage() {
  const { user, loading, login } = useAuth()
  const [username, setUsername] = useState('empleado')
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!loading && user) {
    const isAdmin = user.role === 'admin' || user.role === 'principal'
    return <Navigate to={isAdmin ? '/admin' : '/facturacion'} replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const result = await login(username.trim(), pin)
    setBusy(false)
    if (!result.ok) setError(result.error ?? 'No se pudo iniciar sesión')
  }

  return (
    <main className="login-editorial">
      <section
        className="login-editorial__visual"
        style={{ backgroundImage: `url(${SCENE.hero})` }}
        aria-hidden="true"
      >
        <div className="login-editorial__veil">
          <p className="login-editorial__eyebrow">Desde el horno</p>
          <h1 className="login-editorial__display">Panadería Lela</h1>
          <p className="login-editorial__lede">
            El sabor de cada día, listo para servir.
          </p>
        </div>
      </section>

      <section className="login-editorial__panel">
        <div className="login-editorial__form-wrap">
          <div className="login-editorial__brand">
            <BrandMark size={44} className="brand-mark" />
            <div>
              <p className="login-editorial__kicker">Acceso al sistema</p>
              <h2 className="login-editorial__title">Bienvenido</h2>
            </div>
          </div>

          <form className="login-editorial__form" onSubmit={onSubmit}>
            <div className="field">
              <label className="field__label" htmlFor="username">
                Usuario
              </label>
              <input
                id="username"
                className="field__input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="pin">
                PIN
              </label>
              <input
                id="pin"
                className="field__input"
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            {error ? <p className="login-form__error">{error}</p> : null}
            <button
              className="btn btn--primary btn--block"
              type="submit"
              disabled={busy}
            >
              {busy ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        </div>
      </section>
    </main>
  )
}
