import { Link } from 'react-router'

/** Fallback link to ops home (no Inicio tab in primary nav). */
export function BackHomeButton() {
  return (
    <Link className="md-text-btn md-text-btn--page" to="/facturacion">
      <svg
        className="md-text-btn__icon"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <path
          fill="currentColor"
          d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"
        />
      </svg>
      Facturación
    </Link>
  )
}
