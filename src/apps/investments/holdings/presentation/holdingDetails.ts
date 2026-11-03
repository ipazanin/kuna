import { exposureOf } from '../domain/exposure'
import type { ExposureMix, ExposureSource, HoldingExposure } from '../domain/exposure'
import type { HoldingFigures } from '../domain/holding'
import { groupName } from './mixDonut'
import { words } from './words'
import type { FactsBook } from '../../prices/domain/factsBook'
import { PRICE_VENDORS } from '../../prices/infrastructure/vendors/priceVendors'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import { FUND_MIXES } from '../../workbook/domain/mixGroup'
import { DECIMAL_ZERO, decimalText } from '../../../../shared/money/decimal'
import { formatCostShare } from '../../../../shared/money/moneyFormat'
import { plural } from '../../../../shared/text/translation'
import type { Fact } from '../../../../shared/ui/FactGrid.vue'

/** What a holding's page says the holding is, each fact with where it came from. */
export interface HoldingDetails {
  readonly facts: readonly Fact[]
  /** The mixes a holding with a value spreads over two groups or more of, each drawn as a ring. */
  readonly rings: readonly ExposureMix[]
  /** What its rings wait for: a fund that no mix spreads waits for its mix, one held with no price for its price. */
  readonly ringsWaitFor: 'mix' | 'price' | null
}

const text = words.details

/**
 * Its type, class, sector, country or region, ISIN, a fund's TER and dividends, and its price source. A sector or a
 * country comes from `exposureOf`, so the page names the source the mixes of Holdings use. Physical gold and a coin
 * have no sector, country or ISIN to type, so they show one only when it is there.
 */
export function holdingDetails(holding: Pick<HoldingFigures, 'instrument' | 'quantity' | 'valuation'>, book: InvestmentBook, facts: FactsBook): HoldingDetails {
  const { instrument } = holding
  const type = facts.typeOf(instrument)
  const fund = type === 'fund'
  const placeless = type === 'gold' || type === 'crypto'
  const vendor = PRICE_VENDORS.find((candidate) => candidate.id === instrument.prices)
  const exposures = FUND_MIXES.map((mix) => ({ mix, exposure: exposureOf(instrument, mix, book, facts) }))
  const spread = exposures.filter(({ exposure }) => exposure.lines.length >= 2).map(({ mix }) => mix)
  const unpriced = holding.quantity > DECIMAL_ZERO && holding.valuation === null
  return {
    facts: [
      {
        label: text.type,
        value: type === null ? text.notKnown : words.types[type],
        caption: instrument.type !== null ? text.typed : type !== null && vendor !== undefined ? text.searched(vendor.name) : text.typeIt,
      },
      { label: text.class, value: words.classes[instrument.class], caption: text.typed },
      ...exposures.filter(({ exposure }) => !placeless || exposure.from !== null).map(({ mix, exposure }) => exposureFact(mix, exposure, book)),
      ...(!placeless || instrument.isin !== null ? [{ label: text.isin, value: instrument.isin ?? text.notKnown, caption: instrument.isin === null ? text.typeIt : text.typed }] : []),
      ...(fund || instrument.ter !== null
        ? [
            {
              label: text.ter,
              value: instrument.ter === null ? text.notKnown : formatCostShare(Number(decimalText(instrument.ter)) / 100),
              caption: instrument.ter === null ? text.typeIt : text.typed,
            },
          ]
        : []),
      ...(fund || instrument.distribution !== null
        ? [
            {
              label: text.distribution,
              value: instrument.distribution === null ? text.notKnown : words.distributions[instrument.distribution],
              caption: instrument.distribution === null ? text.typeIt : text.typed,
            },
          ]
        : []),
      vendor === undefined
        ? { label: text.prices, value: words.instrumentDialog.manual, caption: text.typed }
        : { label: text.prices, value: vendor.name, caption: text.atSource(instrument.sourceSymbol) },
    ],
    rings: holding.valuation === null ? [] : spread,
    ringsWaitFor: fund && spread.length === 0 ? 'mix' : spread.length > 0 && unpriced ? 'price' : null,
  }
}

const SOURCES: Readonly<Record<ExposureSource, string>> = {
  'fund-mix': text.sources.fundMix,
  typed: text.typed,
  'fund-weights': text.sources.fundWeights,
  profile: text.sources.profile,
  isin: text.sources.isin,
}

function exposureFact(mix: ExposureMix, exposure: HoldingExposure<ExposureMix>, book: InvestmentBook): Fact {
  const [first, second] = exposure.lines
  const label = mix === 'sector' ? text.sector : text.country
  if (exposure.from === null || first === undefined) return { label, value: text.notKnown, caption: text.typeIt }
  const count = exposure.lines.length
  return { label, value: second === undefined ? groupName(mix, first.group, book) : plural(text.spread[mix](count), count), caption: SOURCES[exposure.from] }
}
