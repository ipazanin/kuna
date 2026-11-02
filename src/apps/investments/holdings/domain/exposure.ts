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

const WHOLE = decimalOfText('100')!

/**
 * Where a holding sits in the sector or the country mix: its fund mix as typed, else its own typed field, else for the
 * sector mix the fund weights a vendor gave, else for a share the sector or the country of its company's profile a
 * vendor gave, else for a share its country from the first two letters of its ISIN. Its type is the typed one, else
 * the one a vendor's search gave. A fund's or an unknown instrument's profile and ISIN may name its issuer or its
 * domicile, not what it holds, so only a share takes them. Empty when none of them says.
 */
export function exposureOf<Mix extends ExposureMix>(instrument: Instrument, mix: Mix, book: InvestmentBook, facts: FactsBook): Exposure<Mix>[] {
  const whole = (group: string | null): Exposure<Mix>[] => (group === null ? [] : [{ group: group as ExposureGroup<Mix>, percent: WHOLE }])
  const lines = book.fundMixes.filter((line) => line.instrument === instrument.id && line.slice.mix === mix)
  if (lines.length > 0) {
    return lines.map((line) => ({ group: line.slice.group as ExposureGroup<Mix>, percent: line.percent }))
  }
  const typed = mix === 'sector' ? instrument.sector : instrument.country
  if (typed !== null) {
    return whole(typed)
  }
  const weights = mix === 'sector' ? facts.sectorWeightsOf(instrument) : []
  if (weights.length > 0) {
    return weights.map((weight) => ({ group: weight.sector as ExposureGroup<Mix>, percent: weight.percent }))
  }
  if (facts.typeOf(instrument) !== 'share') {
    return []
  }
  const profile = facts.profileOf(instrument)
  const profiled = mix === 'sector' ? profile.sector : profile.country
  if (profiled !== null) {
    return whole(profiled)
  }
  return whole(mix === 'country' && instrument.isin !== null ? countryOf(instrument.isin.slice(0, 2)) : null)
}
