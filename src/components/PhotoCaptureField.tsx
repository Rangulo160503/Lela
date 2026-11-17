import { useRef, useState } from 'react'
import { apiPost } from '../data/api'
import { fileToJpegDataUrl } from '../lib/imageCapture'

type PhotoCaptureFieldProps = {
  value: string
  onChange: (path: string) => void
  onError?: (message: string) => void
  kind?: string
  label?: string
}

/** Cámara / galería → upload local. Sin biblioteca de stock. */
export function PhotoCaptureField({
  value,
  onChange,
  onError,
  kind = 'expense',
  label = 'Foto',
}: PhotoCaptureFieldProps) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function handleFile(file: File | undefined) {
    if (!file) return
    setBusy(true)
    try {
      const dataUrl = await fileToJpegDataUrl(file)
      const result = await apiPost<
        { ok: true; path: string } | { ok: false; error: string }
      >('/uploads', { dataUrl, kind })
      if (!result.ok) {
        onError?.(result.error || 'No se pudo subir la foto')
        return
      }
      onChange(result.path)
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
      <legend className="field__label">{label}</legend>

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
        {value ? (
          <button
            type="button"
            className="btn btn--ghost"
            disabled={busy}
            onClick={() => onChange('')}
          >
            Quitar
          </button>
        ) : null}
      </div>

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
    </fieldset>
  )
}
