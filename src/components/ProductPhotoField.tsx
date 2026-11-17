import { useRef, useState } from 'react'
import { apiPost } from '../data/api'
import { PRODUCT_PHOTO_LIBRARY } from '../data/productVisuals'
import { fileToJpegDataUrl } from '../lib/imageCapture'

type ProductPhotoFieldProps = {
  value: string
  onChange: (path: string) => void
  onError?: (message: string) => void
}

export function ProductPhotoField({
  value,
  onChange,
  onError,
}: ProductPhotoFieldProps) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [showLibrary, setShowLibrary] = useState(false)

  async function handleFile(file: File | undefined) {
    if (!file) return
    setBusy(true)
    try {
      const dataUrl = await fileToJpegDataUrl(file)
      const result = await apiPost<{ ok: true; path: string } | { ok: false; error: string }>(
        '/uploads',
        { dataUrl, kind: 'product' },
      )
      if (!result.ok) {
        onError?.(result.error || 'No se pudo subir la foto')
        return
      }
      onChange(result.path)
      setShowLibrary(false)
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'No se pudo usar la foto')
    } finally {
      setBusy(false)
      if (cameraRef.current) cameraRef.current.value = ''
      if (galleryRef.current) galleryRef.current.value = ''
    }
  }

  return (
    <fieldset className="photo-field">
      <legend className="field__label">Foto del producto</legend>

      <div
        className="photo-field__preview"
        style={{ backgroundImage: value ? `url(${value})` : undefined }}
        aria-hidden="true"
      />

      <div className="photo-field__actions">
        <button
          type="button"
          className="btn btn--primary"
          disabled={busy}
          onClick={() => cameraRef.current?.click()}
        >
          {busy ? 'Subiendo…' : 'Tomar foto'}
        </button>
        <button
          type="button"
          className="btn btn--secondary"
          disabled={busy}
          onClick={() => galleryRef.current?.click()}
        >
          Galería
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          disabled={busy}
          onClick={() => setShowLibrary((v) => !v)}
        >
          {showLibrary ? 'Ocultar biblioteca' : 'Biblioteca'}
        </button>
      </div>

      <p className="photo-field__hint">
        En el teléfono se abre la cámara. También puedes elegir una foto de la
        galería o una imagen de biblioteca.
      </p>

      <input
        ref={cameraRef}
        className="visually-hidden"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      <input
        ref={galleryRef}
        className="visually-hidden"
        type="file"
        accept="image/*"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />

      {showLibrary ? (
        <div className="photo-picker__grid">
          {PRODUCT_PHOTO_LIBRARY.map((photo) => (
            <button
              key={photo.id}
              type="button"
              className={
                value === photo.path
                  ? 'photo-picker__item photo-picker__item--active'
                  : 'photo-picker__item'
              }
              onClick={() => onChange(photo.path)}
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
      ) : null}
    </fieldset>
  )
}
