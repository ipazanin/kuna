import type { PortfolioSources } from '../../holdings/domain/holding'
import { closeIsLate } from '../../prices/domain/priceBook'
import type { Close } from '../../prices/domain/priceBook'
import { seriesKey } from '../../prices/domain/pricesFile'
import type { SplitNote } from '../../prices/domain/pricesFile'
import type { Instrument } from '../../workbook/domain/instrument'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import { SPLIT_RECORDS } from '../../workbook/domain/investmentKinds'
import type { Split } from '../../workbook/domain/split'
import { parseCivilDate } from '../../../../shared/calendar/civilDate'
import { recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** The instrument Performance compares the portfolio with: the first one marked, so two marks that a merge left still name one. */
export function benchmarkOf(instruments: readonly Instrument[]): Instrument | null {
  return instruments.find((instrument) => instrument.benchmark) ?? null
}

/** An instrument record before and after a change. */
export interface InstrumentChange {
  readonly before: Instrument
  readonly after: Instrument
}

/** The changes that leave the chosen instrument the only one marked as the benchmark, or none marked when nothing is chosen. */
export function benchmarkChanges(instruments: readonly Instrument[], chosen: RecordId | null): InstrumentChange[] {
  return instruments
    .filter((instrument) => instrument.benchmark !== (instrument.id === chosen))
    .map((instrument) => ({ before: instrument, after: { ...instrument, benchmark: !instrument.benchmark } }))
}

/**
 * Where the benchmark's closes stand today: none chosen, chosen with no close in the prices file yet, or priced at its
 * latest close, which is late after three weekdays as any fetched close is.
 */
export type BenchmarkState =
  | { readonly kind: 'none' }
  | { readonly kind: 'no-closes'; readonly instrument: Instrument }
  | { readonly kind: 'priced'; readonly instrument: Instrument; readonly close: Close; readonly late: boolean }

export function benchmarkState(sources: PortfolioSources): BenchmarkState {
  const instrument = benchmarkOf(sources.book.instruments)
  if (instrument === null) {
    return { kind: 'none' }
  }
  const close = sources.prices.closeOnOrBefore(instrument, sources.today)
  return close === null ? { kind: 'no-closes', instrument } : { kind: 'priced', instrument, close, late: closeIsLate(close, sources.today) }
}

/** The instrument the figures compare with, and the splits its closes are counted after. */
export interface Benchmark {
  readonly instrument: Instrument
  /** The book's splits of it, or when the book has none, the prices file's notes of its listing, as for an index nobody holds. */
  readonly splits: readonly Split[]
}

/** The benchmark once it has a close, since a comparison needs one. */
export function comparedBenchmark(state: BenchmarkState, book: InvestmentBook, notes: readonly SplitNote[]): Benchmark | null {
  if (state.kind !== 'priced') {
    return null
  }
  const { instrument } = state
  const recorded = book.splits.filter((split) => split.instrument === instrument.id)
  if (recorded.length > 0 || instrument.prices === 'manual') {
    return { instrument, splits: recorded }
  }
  const series = seriesKey(instrument.prices, instrument.sourceSymbol)
  const noted = notes
    .filter((note) => note.series === series)
    .map((note): Split => ({
      id: recordIdOf(SPLIT_RECORDS, `${note.series} ${note.date}`),
      instrument: instrument.id,
      date: parseCivilDate(note.date)!,
      newUnits: Number(note.newUnits),
      oldUnits: Number(note.oldUnits),
      importKey: null,
      note: '',
    }))
  return { instrument, splits: noted }
}
