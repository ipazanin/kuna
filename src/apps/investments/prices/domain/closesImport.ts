import { seriesKey } from './pricesFile'
import type { CloseRow, PricesFile } from './pricesFile'
import type { Instrument } from '../../workbook/domain/instrument'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import type { CivilDate } from '../../../../shared/calendar/civilDate'

/** The symbol a file of closes is named after, such as SXR8.DE for `SXR8.DE.csv`, as Yahoo names its history downloads. */
function symbolOfFile(fileName: string): string {
  return fileName
    .replace(/\.csv$/i, '')
    .trim()
    .toUpperCase()
}

/** The holdings, held or sold, whose symbol or price source's symbol the file is named after, ignoring case. Those priced by hand have no series to fill. */
export function holdingsNamedBy(fileName: string, instruments: readonly Instrument[]): Instrument[] {
  const symbol = symbolOfFile(fileName)
  return instruments.filter((instrument) => instrument.prices !== 'manual' && (instrument.symbol.toUpperCase() === symbol || instrument.sourceSymbol.toUpperCase() === symbol))
}

/** What one file of closes adds to a holding's series, as the dry run shows it before anything is written. */
export interface ClosesImportLine {
  readonly instrument: Instrument
  readonly closes: readonly CloseRow[]
  readonly first: CivilDate
  readonly last: CivilDate
  /** Days the series did not have. */
  readonly added: number
  /** Days the series had, which the file's closes take the place of. */
  readonly replaced: number
  /** The holding's first buy when the file starts after it, so the days between have no close from the file. */
  readonly gapFrom: CivilDate | null
}

/** The day the holding was first bought or received, or null for one never held, such as the benchmark. */
function firstAcquired(book: InvestmentBook, instrument: Instrument): CivilDate | null {
  const days = [
    ...book.trades.filter((trade) => trade.instrument === instrument.id && trade.side === 'buy').map((trade) => trade.date),
    ...book.spinOffs.filter((spinOff) => spinOff.received === instrument.id).map((spinOff) => spinOff.date),
  ]
  return days.reduce<CivilDate | null>((earliest, day) => (earliest === null || day < earliest ? day : earliest), null)
}

/** The dry run of one file's closes against the holding's series in the prices file. The closes are oldest first and not empty. */
export function closesImportLine(file: PricesFile, book: InvestmentBook, instrument: Instrument, closes: readonly CloseRow[]): ClosesImportLine {
  const known = new Set((file.series[seriesKey(instrument.prices, instrument.sourceSymbol)]?.closes ?? []).map(([day]) => day))
  const replaced = closes.filter(([day]) => known.has(day)).length
  const first = closes[0]![0] as CivilDate
  const bought = firstAcquired(book, instrument)
  return { instrument, closes, first, last: closes[closes.length - 1]![0] as CivilDate, added: closes.length - replaced, replaced, gapFrom: bought !== null && bought < first ? bought : null }
}

/**
 * The prices file with each line's closes in its holding's own series, the series a vendor fills, merged by day with
 * the file's close taking the place of one already there. The series counts as asked for from the file's first day,
 * so the fetch never asks the vendor for those days again and asks only after the last close. A later fetch's close
 * of a day it asks for takes the place of the file's.
 */
export function withImportedCloses(file: PricesFile, lines: readonly ClosesImportLine[]): PricesFile {
  const series = { ...file.series }
  for (const line of lines) {
    const key = seriesKey(line.instrument.prices, line.instrument.sourceSymbol)
    const known = series[key]
    const byDay = new Map<string, string>([...(known?.closes ?? []), ...line.closes])
    series[key] = {
      currency: known?.currency ?? line.instrument.currency,
      from: known === undefined || line.first < known.from ? line.first : known.from,
      checked: known?.checked ?? null,
      closes: [...byDay.keys()].sort().map((day): CloseRow => [day, byDay.get(day)!]),
    }
  }
  return { ...file, series }
}
