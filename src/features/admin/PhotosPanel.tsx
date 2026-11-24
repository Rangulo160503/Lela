import { useEffect, useRef, useState } from 'react'
import { SoftConfirm } from '../../components/SoftConfirm'
import { apiGet, apiPost } from '../../data/api'
import { fileToJpegDataUrl } from '../../lib/imageCapture'

type LibraryItem = {
  path: string
  name: string
  createdAt?: string
}

type PhotosPanelProps = {
  onMessage?: (msg: string) => void
}

export function PhotosPanel({ onMessage }: PhotosPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<LibraryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  async function refresh() {
    setLoading(true)
    try {
      const res = await apiGet<{ ok: true; items: LibraryItem[] }>('/uploads/library')
      setItems(res.items ?? [])
    } catch (err) {
      onMessage?.(err instanceof Error ? err.message : 'No se pudieron cargar las fotos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  async function handleFile(file: File | undefined) {
    if (!file) return
    setBusy(true)
    try {
      const dataUrl = await fileToJpegDataUrl(file)
      const result = await apiPost<{ ok: true; path: string } | { ok: false; error: string }>(
        '/uploads',
        { dataUrl, kind: 'library' },
      )
      if (!result.ok) {
        onMessage?.(result.error || 'No se pudo subir la foto')
        return
      }
      onMessage?.('Foto guardada')
      await refresh()
    } catch (err) {
      onMessage?.(err instanceof Error ? err.message : 'No se pudo subir la foto')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function remove(path: string) {
    setBusy(true)
    try {
      const result = await apiPost<{ ok: true } | { ok: false; error: string }>(
        '/uploads/delete',
        { path },
      )
      if (!result.ok) {
        onMessage?.(result.error || 'No se pudo eliminar')
        return
      }
      onMessage?.('Foto eliminada')
      await refresh()
    } catch (err) {
      onMessage?.(err instanceof Error ? err.message : 'No se pudo eliminar')
    } finally {
      setBusy(false)
      setPendingDelete(null)
    }
  }

  return (
    <section className="admin-panel">
      <div className="ds-toolbar">
        <div className="ds-toolbar__start">
          <h2 className="ds-toolbar__title">Fotos</h2>
          <p className="ds-toolbar__meta">
            Subí fotos aquí para reutilizarlas en productos, combos o materia prima.
          </p>
        </div>
        <button
          type="button"
          className="btn btn--primary"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? 'Subiendo…' : 'Subir foto'}
        </button>
      </div>

      <input
        ref={fileRef}
        className="visually-hidden"
        type="file"
        accept="image/*"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />

      {loading ? (
        <p className="ds-empty">Cargando fotos…</p>
      ) : items.length === 0 ? (
        <p className="ds-empty">
          Sin fotos guardadas. Usá «Subir foto» como en cualquier formulario.
        </p>
      ) : (
        <div className="photo-library">
          {items.map((item) => (
            <article key={item.path} className="photo-library__card">
              <div
                className="photo-library__media"
                style={{ backgroundImage: `url(${item.path})` }}
                role="img"
                aria-label={item.name}
              />
              <div className="photo-library__meta">
                <p className="photo-library__name">{item.name}</p>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  disabled={busy}
                  onClick={() => setPendingDelete(item.path)}
                >
                  Eliminar
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <SoftConfirm
        open={Boolean(pendingDelete)}
        danger
        title="¿Eliminar esta foto?"
        body="Se borra del álbum guardado. Los productos que ya la usan no cambian solos."
        confirmLabel="Sí, eliminar"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) void remove(pendingDelete)
        }}
      />
    </section>
  )
}
