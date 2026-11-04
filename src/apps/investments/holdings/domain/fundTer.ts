import type { FactsBook } from '../../prices/domain/factsBook'
import type { Instrument } from '../../workbook/domain/instrument'
import type { Decimal } from '../../../../shared/money/decimal'

/** A fund's yearly cost in percent, and the vendor whose fund profile gave it, or null for one typed in the Investments file. */
export interface FundTer {
  readonly percent: Decimal
  readonly vendor: string | null
}

/** The TER typed on the instrument, else the one its fund profile gives. A typed TER wins whatever a vendor says. */
export function fundTerOf(instrument: Instrument, facts: FactsBook): FundTer | null {
  if (instrument.ter !== null) {
    return { percent: instrument.ter, vendor: null }
  }
  const fetched = facts.fundProfileOf(instrument)
  return fetched === null || fetched.ter === null ? null : { percent: fetched.ter, vendor: fetched.vendor }
}
