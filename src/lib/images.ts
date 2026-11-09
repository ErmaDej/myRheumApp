const MAX_INPUT_BYTES = 15 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export interface CompressedImage {
  dataUrl: string
  width: number
  height: number
  bytes: number
}

/**
 * Resize and re-encode a photo entirely in the browser. Clinical comparison
 * photographs must not be beautified or reshaped, so this only downscales and
 * applies a single neutral JPEG quality setting.
 */
export const compressImage = async (
  file: File,
  maxDimension = 1200,
  quality = 0.85,
): Promise<CompressedImage> => {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Use a JPEG, PNG or WebP image.')
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error('Image is larger than 15 MB. Please choose a smaller file.')
  }

  const bitmap = await loadBitmap(file)
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) {
    if ('close' in bitmap) bitmap.close()
    throw new Error('This browser cannot process images.')
  }
  context.drawImage(bitmap, 0, 0, width, height)
  if ('close' in bitmap) bitmap.close()

  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  return { dataUrl, width, height, bytes: Math.round((dataUrl.length * 3) / 4) }
}

const loadBitmap = async (file: File): Promise<ImageBitmap | HTMLImageElement> => {
  if ('createImageBitmap' in window) {
    return await createImageBitmap(file)
  }
  const url = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error('Could not read this image.'))
      element.src = url
    })
    return image
  } finally {
    URL.revokeObjectURL(url)
  }
}
