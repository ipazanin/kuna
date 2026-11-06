import { parseCivilDate } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { moneyFromCents } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'

/** What a fiscal receipt's QR code says. It names no merchant and no lines. */
export interface FiscalQr {
  /** Blank when the code carries the ZKI instead. */
  readonly jir: string
  /** Blank when the code carries the JIR instead. */
  readonly zki: string
  readonly issuedOn: CivilDate
  readonly issuedTime: string
  readonly total: Money
}

const CHECK_HOST = 'porezna.gov.hr'
const CHECK_PATHS: readonly string[] = ['/rn', '/rn/']

const JIR = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ZKI = /^[0-9a-f]{32}$/i
const ISSUED = /^(\d{4})(\d{2})(\d{2})_([01]\d|2[0-3])([0-5]\d)$/
const TOTAL = /^(\d+)(?:[.,](\d{0,2}))?$/

/** `izn` with no separator is cents, and with a comma or a dot it is euros. */
function totalOf(text: string): Money | null {
  const [, whole, decimals] = TOTAL.exec(text) ?? []
  if (whole === undefined) return null
  const cents = decimals === undefined ? Number(whole) : Number(whole) * 100 + Number(decimals.padEnd(2, '0'))
  return Number.isSafeInteger(cents) && cents > 0 ? moneyFromCents(cents) : null
}

function addressOf(text: string): URL | null {
  try {
    return new URL(text.trim())
  } catch {
    return null
  }
}

/**
 * Reads a fiscal QR code's text: `jir` or `zki`, `datv` as `yyyymmdd_hhmm` and `izn`, from Porezna uprava's check address.
 * Null for any other address and for a code missing one of them, so a shop's own QR code reads as no fiscal code.
 */
export function fiscalQr(text: string): FiscalQr | null {
  const address = addressOf(text)
  if (address === null || address.hostname !== CHECK_HOST || !CHECK_PATHS.includes(address.pathname) || !['https:', 'http:'].includes(address.protocol)) return null
  const jir = address.searchParams.get('jir') ?? ''
  const zki = address.searchParams.get('zki') ?? ''
  if (!JIR.test(jir) && !ZKI.test(zki)) return null
  const [, year, month, day, hour, minute] = ISSUED.exec(address.searchParams.get('datv') ?? '') ?? []
  const issuedOn = parseCivilDate(`${year}-${month}-${day}`)
  const total = totalOf(address.searchParams.get('izn') ?? '')
  if (issuedOn === null || total === null) return null
  return { jir: JIR.test(jir) ? jir : '', zki: ZKI.test(zki) ? zki : '', issuedOn, issuedTime: `${hour}:${minute}`, total }
}
