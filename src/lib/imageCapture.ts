/** Comprime una imagen del móvil/cámara a JPEG base64 para subir sin dependencias. */

const MAX_EDGE = 1280
const JPEG_QUALITY = 0.72

export async function fileToJpegDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    throw new Error('No se pudo procesar la imagen')
  }
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
  if (!dataUrl.startsWith('data:image/jpeg')) {
    throw new Error('Formato de imagen no soportado')
  }
  return dataUrl
}
