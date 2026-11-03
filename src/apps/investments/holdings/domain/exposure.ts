import type { FactsBook } from '../../prices/domain/factsBook'
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

/** Which source placed a holding in a mix, in the order the sources count: its typed fund mix, its typed field, a fund's fetched weights, a share's fetched profile, a share's ISIN. */
export type ExposureSource = 'fund-mix' | 'typed' | 'fund-weights' | 'profile' | 'isin'

/** Where a holding sits in one mix, and which source said so. Null with no lines when none of them says. */
export interface HoldingExposure<Mix extends ExposureMix> {
  readonly from: ExposureSource | null
  readonly lines: readonly Exposure<Mix>[]
}

const WHOLE = decimalOfText('100')!

/**
 * Where a holding sits in the sector or the country mix: its fund mix as typed, else its own typed field, else for the
 * sector mix the fund weights a vendor gave, else for a share the sector or the country of its company's profile a
 * vendor gave, else for a share its country from the first two letters of its ISIN. Its type is the typed one, else
 * the one a vendor's search gave. A fund's or an unknown instrument's profile and ISIN may name its issuer or its
 * domicile, not what it holds, so only a share takes them.
 */
export function exposureOf<Mix extends ExposureMix>(instrument: Instrument, mix: Mix, book: InvestmentBook, facts: FactsBook): HoldingExposure<Mix> {
  const whole = (from: ExposureSource, group: string | null): HoldingExposure<Mix> =>
    group === null ? { from: null, lines: [] } : { from, lines: [{ group: group as ExposureGroup<Mix>, percent: WHOLE }] }
  const lines = book.fundMixes.filter((line) => line.instrument === instrument.id && line.slice.mix === mix)
  if (lines.length > 0) {
    return { from: 'fund-mix', lines: lines.map((line) => ({ group: line.slice.group as ExposureGroup<Mix>, percent: line.percent })) }
  }
  const typed = mix === 'sector' ? instrument.sector : instrument.country
  if (typed !== null) {
    return whole('typed', typed)
  }
  const weights = mix === 'sector' ? facts.sectorWeightsOf(instrument) : []
  if (weights.length > 0) {
    return { from: 'fund-weights', lines: weights.map((weight) => ({ group: weight.sector as ExposureGroup<Mix>, percent: weight.percent })) }
  }
  if (facts.typeOf(instrument) !== 'share') {
    return { from: null, lines: [] }
  }
  const profile = facts.profileOf(instrument)
  const profiled = mix === 'sector' ? profile.sector : profile.country
  if (profiled !== null) {
    return whole('profile', profiled)
  }
  return whole('isin', mix === 'country' && instrument.isin !== null ? countryOf(instrument.isin.slice(0, 2)) : null)
}
