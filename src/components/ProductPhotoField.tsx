import { useRef, useState } from 'react'
import { apiGet, apiPost } from '../data/api'
import { fileToJpegDataUrl } from '../lib/imageCapture'

type SavedPhoto = { path: string; label?: string }

type ProductPhotoFieldProps = {
  value: string
  onChange: (path: string) => void
  onError?: (message: string) => void
  /** Carpeta bajo data/uploads (product | material | combo | …) */
  kind?: string
  label?: string
  /** Permite elegir una foto ya subida en Configuración → Fotos. */
  allowSavedPhotos?: boolean
}

export function ProductPhotoField({
  value,
  onChange,
  onError,
  kind = 'product',
  label = 'Foto',
  allowSavedPhotos = false,
}: ProductPhotoFieldProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [pickingSaved, setPickingSaved] = useState(false)
  const [saved, setSaved] = useState<SavedPhoto[] | null>(null)
  const [loadingSaved, setLoadingSaved] = useState(false)

  async function handleFile(file: File | undefined) {
    if (!file) return
    setBusy(true)
    try {
      const dataUrl = await fileToJpegDataUrl(file)
      const result = await apiPost<{ ok: true; path: string } | { ok: false; error: string }>(
        '/uploads',
        { dataUrl, kind },
      )
      if (!result.ok) {
        onError?.(result.error || 'No se pudo subir la foto')
        return
      }
      onChange(result.path)
      setPickingSaved(false)
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'No se pudo usar la foto')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function openSaved() {
    setPickingSaved((v) => !v)
    if (saved !== null) return
    setLoadingSaved(true)
    try {
      const res = await apiGet<{ ok: true; items: { path: string; name: string }[] }>(
        '/uploads/library',
      )
      setSaved(
        (res.items ?? []).map((item) => ({
          path: item.path,
          label: item.name.replace(/\.[^.]+$/, ''),
        })),
      )
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'No se pudieron cargar las fotos')
      setSaved([])
    } finally {
      setLoadingSaved(false)
    }
  }

  return (
    <fieldset className="photo-field">
      <legend className="field__label">{label}</legend>

      {!value ? (
        <button
          type="button"
          className="photo-field__stage photo-field__stage--empty"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          aria-label="Subir foto"
        >
          <span className="photo-field__placeholder">
            {busy ? 'Subiendo…' : 'Subir foto'}
          </span>
          <span className="photo-field__sub">
            Tocá para elegir del teléfono o la PC
          </span>
        </button>
      ) : (
        <div
          className={
            busy
              ? 'photo-field__stage photo-field__stage--filled photo-field__stage--busy'
              : 'photo-field__stage photo-field__stage--filled'
          }
        >
          <div
            className="photo-field__media"
            style={{ backgroundImage: `url(${value})` }}
            aria-hidden="true"
          />
          <div className="photo-field__veil">
            <button
              type="button"
              className="photo-field__chip"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              {busy ? 'Subiendo…' : 'Cambiar'}
            </button>
            <button
              type="button"
              className="photo-field__chip photo-field__chip--danger"
              disabled={busy}
              onClick={() => onChange('')}
            >
              Quitar
            </button>
          </div>
        </div>
      )}

      {allowSavedPhotos ? (
        <button
          type="button"
          className="photo-field__link"
          disabled={busy}
          onClick={() => void openSaved()}
        >
          {pickingSaved ? 'Cerrar fotos guardadas' : 'Elegir de fotos guardadas'}
        </button>
      ) : null}

      <input
        ref={fileRef}
        className="visually-hidden"
        type="file"
        accept="image/*"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />

      {allowSavedPhotos && pickingSaved ? (
        <div className="photo-picker">
          <p className="photo-picker__title">Fotos guardadas</p>
          {loadingSaved ? (
            <p className="photo-field__hint">Cargando…</p>
          ) : !saved || saved.length === 0 ? (
            <p className="photo-field__hint">
              Todavía no hay fotos en Configuración → Fotos.
            </p>
          ) : (
            <div className="photo-picker__grid">
              {saved.map((photo) => (
                <button
                  key={photo.path}
                  type="button"
                  className={
                    value === photo.path
                      ? 'photo-picker__item photo-picker__item--active'
                      : 'photo-picker__item'
                  }
                  onClick={() => {
                    onChange(photo.path)
                    setPickingSaved(false)
                  }}
                  title={photo.label}
                >
                  <span
                    className="photo-picker__media"
                    style={{ backgroundImage: `url(${photo.path})` }}
                  />
                  <span className="photo-picker__label">{photo.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </fieldset>
  )
}
