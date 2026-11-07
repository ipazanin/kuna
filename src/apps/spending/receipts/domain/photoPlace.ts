import { roundHalfAwayFromZero } from '../../../../shared/money/money'

/** Where a photo was taken, in decimal degrees, as the receipt stores it. */
export interface PhotoPlace {
  readonly latitude: string
  readonly longitude: string
}

const SEGMENT_START = 2
const TIFF_START = 6
const GPS_POINTER = 0x8825
const LATITUDE_REF = 1
const LATITUDE = 2
const LONGITUDE_REF = 3
const LONGITUDE = 4

function degreesAt(view: DataView, offset: number, littleEndian: boolean): number | null {
  let degrees = 0
  for (const [place, unit] of [1, 60, 3600].entries()) {
    const denominator = view.getUint32(offset + place * 8 + 4, littleEndian)
    if (denominator === 0) return null
    degrees += view.getUint32(offset + place * 8, littleEndian) / denominator / unit
  }
  return degrees
}

/** Where the entry of a TIFF directory with this tag sits, or null. */
function entryOf(view: DataView, directory: number, tag: number, littleEndian: boolean): number | null {
  const count = view.getUint16(directory, littleEndian)
  for (let place = 0; place < count; place += 1) {
    const entry = directory + 2 + place * 12
    if (view.getUint16(entry, littleEndian) === tag) return entry
  }
  return null
}

/** Decimal degrees to six places, as data rather than a figure on screen, the same in every language. */
function coordinateText(degrees: number): string {
  const millionths = roundHalfAwayFromZero(Math.abs(degrees) * 1_000_000)
  return `${degrees < 0 ? '-' : ''}${Math.floor(millionths / 1_000_000)}.${String(millionths % 1_000_000).padStart(6, '0')}`
}

function placeInExif(view: DataView): PhotoPlace | null {
  const littleEndian = view.getUint16(0) === 0x4949
  const gpsEntry = entryOf(view, view.getUint32(4, littleEndian), GPS_POINTER, littleEndian)
  if (gpsEntry === null) return null
  const gps = view.getUint32(gpsEntry + 8, littleEndian)
  const signedDegrees = (ref: number, value: number, negative: number): number | null => {
    const refEntry = entryOf(view, gps, ref, littleEndian)
    const valueEntry = entryOf(view, gps, value, littleEndian)
    if (refEntry === null || valueEntry === null) return null
    const degrees = degreesAt(view, view.getUint32(valueEntry + 8, littleEndian), littleEndian)
    return degrees === null ? null : view.getUint8(refEntry + 8) === negative ? -degrees : degrees
  }
  const latitude = signedDegrees(LATITUDE_REF, LATITUDE, 'S'.charCodeAt(0))
  const longitude = signedDegrees(LONGITUDE_REF, LONGITUDE, 'W'.charCodeAt(0))
  // A camera with no fix can write zeros, and nobody buys bread at 0, 0.
  if (latitude === null || longitude === null || (latitude === 0 && longitude === 0) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null
  return { latitude: coordinateText(latitude), longitude: coordinateText(longitude) }
}

/**
 * The GPS position in a JPEG's Exif segment, or null for any other file, a photo with none, or bytes that do not hold together.
 * It walks the segments up to the image data, so it needs only the start of the file.
 */
export function placeInJpeg(bytes: Uint8Array): PhotoPlace | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  try {
    if (view.getUint16(0) !== 0xffd8) return null
    let at = SEGMENT_START
    while (view.getUint8(at) === 0xff && view.getUint8(at + 1) !== 0xda) {
      const size = view.getUint16(at + 2)
      const isExif = view.getUint8(at + 1) === 0xe1 && String.fromCharCode(...bytes.subarray(at + 4, at + 8)) === 'Exif'
      if (isExif) return placeInExif(new DataView(bytes.buffer, bytes.byteOffset + at + 4 + TIFF_START, size - 2 - TIFF_START))
      at += 2 + size
    }
    return null
  } catch (failure) {
    if (failure instanceof RangeError) return null
    throw failure
  }
}

/** A map at the place, which leaves the page only on a tap. Null for coordinates a hand edit made into something else. */
export function mapLinkOf({ latitude, longitude }: PhotoPlace): string | null {
  const [lat, lon] = [Number(latitude), Number(longitude)]
  if (latitude === '' || longitude === '' || !Number.isFinite(lat) || !Number.isFinite(lon)) return null
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=18/${lat}/${lon}`
}
