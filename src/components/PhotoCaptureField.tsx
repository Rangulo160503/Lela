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

/** Preview como control: vacío = subir; con foto = capa Cambiar / Quitar. */
export function PhotoCaptureField({
  value,
  onChange,
  onError,
  kind = 'expense',
  label = 'Foto',
}: PhotoCaptureFieldProps) {
  const fileRef = useRef<HTMLInputElement>(null)
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
      if (fileRef.current) fileRef.current.value = ''
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

      <input
        ref={fileRef}
        className="visually-hidden"
        type="file"
        accept="image/*"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
    </fieldset>
  )
}
