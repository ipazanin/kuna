import type { CivilDate } from '../../../../../shared/calendar/civilDate'

/**
 * The made-up receipt photos the checks upload, each with a real QR code holding a made-up JIR, so the page's own decoder reads
 * it. They are written on the day of the run, since a fixed date falls out of the matching window. Nothing here reaches a production build.
 */

/** The totals in cents of the sample photos: one the receipts set's card payment matches, one its two equal payments share, one a payment with a tip on it comes near, and one nothing matches. */
export const SAMPLE_RECEIPT_TOTALS = { oneMatch: 2349, twoMatches: 4120, near: 3150, noMatch: 1700 } as const

const MADE_UP_JIR = '1a2b3c4d-0000-4000-8000-1234567890ab'

/** What a fiscal receipt's QR code says, in the form Porezna uprava's check page reads. */
export function sampleFiscalQrText(day: CivilDate, cents: number): string {
  return `https://porezna.gov.hr/rn?jir=${MADE_UP_JIR}&datv=${day.replaceAll('-', '')}_1842&izn=${cents}`
}

const SIZE = 37
const ALIGNMENT = 30
const DATA_CODEWORDS = 108
const EC_CODEWORDS = 26

/** Error correction L and mask 0, with its BCH bits, as the QR standard's table gives them. */
const FORMAT_BITS = 0b111011111000100

function gfMultiply(left: number, right: number): number {
  let product = 0
  for (let bit = 7; bit >= 0; bit -= 1) {
    product = (product << 1) ^ ((product >>> 7) * 0x11d)
    product ^= ((right >>> bit) & 1) * left
  }
  return product
}

function errorCorrection(data: readonly number[]): number[] {
  const divisor = new Array<number>(EC_CODEWORDS).fill(0)
  divisor[EC_CODEWORDS - 1] = 1
  let root = 1
  for (let degree = 0; degree < EC_CODEWORDS; degree += 1) {
    for (let place = 0; place < EC_CODEWORDS; place += 1) {
      divisor[place] = gfMultiply(divisor[place]!, root) ^ (divisor[place + 1] ?? 0)
    }
    root = gfMultiply(root, 2)
  }
  const remainder = new Array<number>(EC_CODEWORDS).fill(0)
  for (const byte of data) {
    const factor = byte ^ remainder.shift()!
    remainder.push(0)
    divisor.forEach((coefficient, place) => {
      remainder[place]! ^= gfMultiply(coefficient, factor)
    })
  }
  return remainder
}

/** The codewords of the text in byte mode, padded to version 5-L's one block, with its error correction. */
function codewords(text: string): number[] {
  const bytes = [...new TextEncoder().encode(text)]
  if (bytes.length > DATA_CODEWORDS - 2) throw new Error(`A sample QR code holds ${DATA_CODEWORDS - 2} bytes at most, and this text has ${bytes.length}.`)
  const bits = ['0100', bytes.length.toString(2).padStart(8, '0'), ...bytes.map((byte) => byte.toString(2).padStart(8, '0')), '0000'].join('')
  const data: number[] = []
  for (let bit = 0; bit < bits.length; bit += 8) data.push(Number.parseInt(bits.slice(bit, bit + 8).padEnd(8, '0'), 2))
  for (let pad = 0xec; data.length < DATA_CODEWORDS; pad = pad === 0xec ? 0x11 : 0xec) data.push(pad)
  return [...data, ...errorCorrection(data)]
}

/** The dark modules of a version 5-L QR code with mask 0, row by row. */
export function sampleQrModules(text: string): readonly (readonly boolean[])[] {
  const modules = Array.from({ length: SIZE }, () => new Array<boolean>(SIZE).fill(false))
  const fixed = Array.from({ length: SIZE }, () => new Array<boolean>(SIZE).fill(false))
  const set = (x: number, y: number, dark: boolean): void => {
    modules[y]![x] = dark
    fixed[y]![x] = true
  }
  for (const [left, top] of [
    [0, 0],
    [SIZE - 7, 0],
    [0, SIZE - 7],
  ] as const) {
    for (let y = -1; y <= 7; y += 1) {
      for (let x = -1; x <= 7; x += 1) {
        if (left + x < 0 || top + y < 0 || left + x >= SIZE || top + y >= SIZE) continue
        const ring = Math.max(Math.abs(x - 3), Math.abs(y - 3))
        set(left + x, top + y, ring !== 2 && ring !== 4)
      }
    }
  }
  for (let place = 8; place < SIZE - 8; place += 1) {
    set(place, 6, place % 2 === 0)
    set(6, place, place % 2 === 0)
  }
  for (let y = -2; y <= 2; y += 1) {
    for (let x = -2; x <= 2; x += 1) set(ALIGNMENT + x, ALIGNMENT + y, Math.max(Math.abs(x), Math.abs(y)) !== 1)
  }
  const format = (bit: number): boolean => ((FORMAT_BITS >>> bit) & 1) === 1
  for (let bit = 0; bit <= 5; bit += 1) set(8, bit, format(bit))
  set(8, 7, format(6))
  set(8, 8, format(7))
  set(7, 8, format(8))
  for (let bit = 9; bit < 15; bit += 1) set(14 - bit, 8, format(bit))
  for (let bit = 0; bit < 8; bit += 1) set(SIZE - 1 - bit, 8, format(bit))
  for (let bit = 8; bit < 15; bit += 1) set(8, SIZE - 15 + bit, format(bit))
  set(8, SIZE - 8, true)

  const words = codewords(text)
  let next = 0
  for (let right = SIZE - 1; right >= 1; right -= right === 8 ? 3 : 2) {
    for (let step = 0; step < SIZE; step += 1) {
      const y = ((right + 1) & 2) === 0 ? SIZE - 1 - step : step
      for (const x of [right, right - 1]) {
        if (fixed[y]![x]) continue
        const dark = next < words.length * 8 && ((words[next >>> 3]! >>> (7 - (next & 7))) & 1) === 1
        next += 1
        modules[y]![x] = dark !== ((x + y) % 2 === 0)
      }
    }
  }
  return modules
}

const WIDTH = 480
const HEIGHT = 640
const MODULE = 6

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (crc ^ 0xffffffff) >>> 0
}

function adler32(bytes: Uint8Array): number {
  let low = 1
  let high = 0
  for (const byte of bytes) {
    low = (low + byte) % 65521
    high = (high + low) % 65521
  }
  return ((high << 16) | low) >>> 0
}

function bigEndian(value: number): number[] {
  return [value >>> 24, (value >>> 16) & 255, (value >>> 8) & 255, value & 255]
}

function pngChunk(type: string, data: readonly number[] | Uint8Array): number[] {
  const typed = Uint8Array.from([...new TextEncoder().encode(type), ...data])
  return [...bigEndian(data.length), ...typed, ...bigEndian(crc32(typed))]
}

/** A grey PNG of the rows, its pixels stored without compression. */
function pngOf(rows: readonly Uint8Array[]): Uint8Array {
  const raw = Uint8Array.from(rows.flatMap((row) => [0, ...row]))
  const stored: number[] = [0x78, 0x01]
  for (let start = 0; start < raw.length; start += 0xffff) {
    const end = Math.min(start + 0xffff, raw.length)
    const length = end - start
    stored.push(end === raw.length ? 1 : 0, length & 255, length >>> 8, ~length & 255, (~length >>> 8) & 255, ...raw.subarray(start, end))
  }
  stored.push(...bigEndian(adler32(raw)))
  const header = [...bigEndian(rows[0]!.length), ...bigEndian(rows.length), 8, 0, 0, 0, 0]
  return Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...pngChunk('IHDR', header), ...pngChunk('IDAT', stored), ...pngChunk('IEND', [])])
}

/** A pale sheet with bars for the printed lines and, when given text, a QR code holding it. */
export function sampleReceiptPng(qrText: string | null): Uint8Array {
  const rows = Array.from({ length: HEIGHT }, () => new Uint8Array(WIDTH).fill(250))
  for (let top = 40; top < 280; top += 28) {
    for (let y = top; y < top + 10; y += 1) rows[y]!.fill(150, 60, top % 3 === 0 ? 300 : 420)
  }
  if (qrText !== null) {
    const left = Math.floor((WIDTH - SIZE * MODULE) / 2)
    const top = 340
    sampleQrModules(qrText).forEach((modules, y) => {
      modules.forEach((dark, x) => {
        if (!dark) return
        for (let row = 0; row < MODULE; row += 1) rows[top + y * MODULE + row]!.fill(0, left + x * MODULE, left + (x + 1) * MODULE)
      })
    })
  }
  return pngOf(rows)
}
