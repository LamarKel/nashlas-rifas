// Optimiza una imagen en el navegador: redimensiona y convierte a WebP.
export async function optimizarImagen(file, { maxLado = 1600, calidad = 0.82 } = {}) {
  if (!file.type.startsWith('image/')) throw new Error('El archivo no es una imagen.')
  const bitmap = await cargar(file)
  const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * escala)
  const h = Math.round(bitmap.height * escala)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()

  const blob = await new Promise((res) => canvas.toBlob(res, 'image/webp', calidad))
  if (!blob) throw new Error('Tu navegador no pudo procesar la imagen.')
  // Si por alguna razón quedó más pesada que el original y el original ya es webp, usa el original
  const final = blob.size < file.size || file.type !== 'image/webp' ? blob : file
  return {
    file: new File([final], file.name.replace(/\.[^.]+$/, '') + '.webp', { type: 'image/webp' }),
    antes: file.size,
    despues: final.size,
    ancho: w,
    alto: h,
  }
}

async function cargar(file) {
  if ('createImageBitmap' in window) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }) } catch { /* fallback */ }
  }
  return await new Promise((res, rej) => {
    const img = new Image()
    img.onload = () => res(img)
    img.onerror = () => rej(new Error('No se pudo leer la imagen.'))
    img.src = URL.createObjectURL(file)
  })
}

export const kb = (b) => (b >= 1024 * 1024 ? (b / 1024 / 1024).toFixed(1) + ' MB' : Math.round(b / 1024) + ' KB')
