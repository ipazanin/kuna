import type { Instrument } from '../../workbook/domain/instrument'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import { countryOf } from '../../workbook/domain/mixGroup'
import type { FundMixGroup } from '../../workbook/domain/mixGroup'
import { decimalOfText } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'

/** The two mixes a holding can spread over several groups of, by a fund's own mix. */
export type ExposureMix = FundMixGroup['mix']

export type ExposureGroup<Mix extends ExposureMix> = Extract<FundMixGroup, { readonly mix: Mix }>['group']

/** The part of a holding that falls in one group of a mix, in percent of the holding. */
export interface Exposure<Mix extends ExposureMix> {
  readonly group: ExposureGroup<Mix>
  readonly percent: Decimal
}

const WHOLE = decimalOfText('100')!

/**
 * Where a holding sits in the sector or the country mix: its fund mix as typed, else its own typed field, else for a
 * share's country the first two letters of its ISIN. A fund's ISIN names where it is domiciled, not where it invests,
 * so it never stands in for a fund. Empty when none of them says.
 */
export function exposureOf<Mix extends ExposureMix>(instrument: Instrument, mix: Mix, book: InvestmentBook): Exposure<Mix>[] {
  const lines = book.fundMixes.filter((line) => line.instrument === instrument.id && line.slice.mix === mix)
  if (lines.length > 0) {
    return lines.map((line) => ({ group: line.slice.group as ExposureGroup<Mix>, percent: line.percent }))
  }
  const typed = mix === 'sector' ? instrument.sector : instrument.country
  if (typed !== null) {
    return [{ group: typed as ExposureGroup<Mix>, percent: WHOLE }]
  }
  const fromIsin = mix === 'country' && instrument.isin !== null && isShare(instrument, book) ? countryOf(instrument.isin.slice(0, 2)) : null
  return fromIsin === null ? [] : [{ group: fromIsin as ExposureGroup<Mix>, percent: WHOLE }]
}

/**
 * A single company's stock. No field marks a fund, so only a stock with one typed sector, no fund cost and no fund mix
 * counts. A fund typed with none of them stays not known, and the line under the ring asks for its country.
 */
function isShare(instrument: Instrument, book: InvestmentBook): boolean {
  return instrument.class === 'stocks' && instrument.sector !== null && instrument.ter === null && !book.fundMixes.some((line) => line.instrument === instrument.id)
}
