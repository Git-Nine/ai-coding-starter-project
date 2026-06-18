import exifr from 'exifr'

/** GPS + capture date pulled from a photo's EXIF, where present. */
export type PhotoExif = {
  lat: number | null
  lng: number | null
  takenAt: string | null
}

const HEIC_RE = /(heic|heif)/i

/** True for HEIC/HEIF, which most non-Safari browsers can't draw to a canvas. */
export function isHeic(file: File): boolean {
  return HEIC_RE.test(file.type) || HEIC_RE.test(file.name)
}

/**
 * Read GPS coordinates and the capture date from a photo's EXIF.
 * MUST run on the original file — downscaling re-encodes the image and strips
 * EXIF, so this is always called before {@link downscaleImage}. Never throws;
 * returns nulls when EXIF is missing, stripped, or unreadable.
 */
export async function readPhotoExif(file: File): Promise<PhotoExif> {
  const empty: PhotoExif = { lat: null, lng: null, takenAt: null }
  try {
    const [gps, parsed] = await Promise.all([
      exifr.gps(file).catch(() => null),
      exifr.parse(file, ['DateTimeOriginal', 'CreateDate']).catch(() => null),
    ])
    const taken = parsed?.DateTimeOriginal ?? parsed?.CreateDate ?? null
    return {
      lat: typeof gps?.latitude === 'number' ? gps.latitude : null,
      lng: typeof gps?.longitude === 'number' ? gps.longitude : null,
      takenAt: taken instanceof Date && !isNaN(taken.valueOf()) ? taken.toISOString() : null,
    }
  } catch {
    return empty
  }
}

const MAX_DIMENSION = 1600 // px on the longest edge — plenty for review + future vision
const JPEG_QUALITY = 0.85

/**
 * Shrink an image in the browser so the longest edge is at most MAX_DIMENSION,
 * re-encoding as JPEG to keep uploads small. Returns the original file untouched
 * for HEIC (can't be drawn to canvas outside Safari) or if anything fails — the
 * caller always gets an uploadable File.
 */
export async function downscaleImage(file: File): Promise<File> {
  if (isHeic(file)) return file

  try {
    const bitmap = await createImageBitmap(file)
    const { width, height } = bitmap
    const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height))

    if (scale >= 1) {
      bitmap.close()
      return file // already small enough — don't re-encode
    }

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      return file
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
    )
    if (!blob) return file

    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified })
  } catch {
    return file
  }
}
