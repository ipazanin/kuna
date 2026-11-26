import { seriesKey } from '../../prices/domain/pricesFile'
import type { SplitNote } from '../../prices/domain/pricesFile'
import type { Instrument } from '../../workbook/domain/instrument'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import { SPLIT_RECORDS } from '../../workbook/domain/investmentKinds'
import type { Split } from '../../workbook/domain/split'
import { parseCivilDate } from '../../../../shared/calendar/civilDate'
import { recordIdOf } from '../../../../shared/storage/domain/recordId'

/**
 * The splits an instrument's closes count in today's units after, as records of it. Those are its own split records,
 * or else those of the first instrument priced by the same series that has any, since a split recorded on one holding
 * of a listing splits the closes they share, or else the splits the vendor reported for the series, which the prices
 * file notes.
 */
export function seriesSplits(instrument: Instrument, book: InvestmentBook, notes: readonly SplitNote[]): Split[] {
  const own = book.splits.filter((split) => split.instrument === instrument.id)
  if (own.length > 0 || instrument.prices === 'manual') return own
  const series = seriesKey(instrument.prices, instrument.sourceSymbol)
  const shared = book.instruments
    .filter((named) => named.prices !== 'manual' && seriesKey(named.prices, named.sourceSymbol) === series)
    .map((named) => book.splits.filter((split) => split.instrument === named.id))
    .find((splits) => splits.length > 0)
  if (shared !== undefined) return shared.map((split) => ({ ...split, instrument: instrument.id }))
  return notes
    .filter((note) => note.series === series)
    .map((note): Split => ({
      id: recordIdOf(SPLIT_RECORDS, `${note.series} ${note.date}`),
      instrument: instrument.id,
      date: parseCivilDate(note.date)!,
      newUnits: Number(note.newUnits),
      oldUnits: Number(note.oldUnits),
      importKeys: [],
      note: '',
    }))
}
