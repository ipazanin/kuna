import { exposureOf } from '../domain/exposure'
import type { ExposureMix, ExposureSource, HoldingExposure } from '../domain/exposure'
import { fundTerOf } from '../domain/fundTer'
import type { HoldingFigures, PortfolioSources } from '../domain/holding'
import { yearRange } from '../domain/priceHistory'
import { groupName } from './mixDonut'
import { words } from './words'
import { daysBeforeAskedAgain } from '../../prices/application/factFetch'
import type { FactProblem, FactsBook } from '../../prices/domain/factsBook'
import { PRICE_VENDORS } from '../../prices/infrastructure/vendors/priceVendors'
import type { Instrument } from '../../workbook/domain/instrument'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import { FUND_MIXES, countryOfIsin } from '../../workbook/domain/mixGroup'
import { addDays } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { DECIMAL_ZERO, decimalText, scaledDecimal } from '../../../../shared/money/decimal'
import { formatCompactAmount, formatCostShare, formatCount, formatUnitPrice } from '../../../../shared/money/moneyFormat'
import { countryName } from '../../../../shared/text/countryName'
import { plural } from '../../../../shared/text/translation'
import type { Fact } from '../../../../shared/ui/FactGrid.vue'

/** What a holding's page says the holding is, each fact with where it came from. */
export interface HoldingDetails {
  readonly facts: readonly Fact[]
  /** The mixes a holding with a value spreads over two groups or more of, each drawn as a ring. */
  readonly rings: readonly ExposureMix[]
  /** What its rings wait for: a fund that no mix spreads waits for its mix, one held with no price for its price. */
  readonly ringsWaitFor: 'mix' | 'price' | null
  /** The warning a leveraged fund shows, naming the vendor that says so, or null. */
  readonly leveraged: string | null
  /** The facts a vendor sent nothing usable for, of a holding held, or null where there are none. */
  readonly problems: FactWarning | null
}

/** What vendors sent nothing usable for, and when Kuna asks them again by itself. */
export interface FactWarning {
  /** One per fact, naming the vendor, what was asked and what came back. */
  readonly sentences: readonly string[]
  /** The vendors asked, so the page can say which of their keys this browser lacks. */
  readonly vendors: readonly { readonly id: string; readonly name: string }[]
  /** The earliest day they were asked. */
  readonly askedOn: CivilDate
  /** The day Kuna's own fetch asks the earliest of them again. */
  readonly asksAgainOn: CivilDate
}

const text = words.details

/** The name a vendor goes by, or its id for one this Kuna does not know. */
function vendorName(vendorId: string): string {
  return PRICE_VENDORS.find((candidate) => candidate.id === vendorId)?.name ?? vendorId
}

/** Millions, the unit Finnhub's own example implies for its market capitalisation, which its documentation does not state. */
const MARKET_CAP_UNIT = 1_000_000n

/**
 * Its type, class, sector, country or region, a fund's domicile, ISIN, a share's exchange, market capitalisation and
 * IPO, a fund's TER, size, start, holdings and dividends, its range over 52 weeks, and its price source. A sector or a
 * country comes from `exposureOf`, so the page names the source the mixes of Holdings use. Physical gold and a coin
 * have no sector, country or ISIN to type, so they show one only when it is there. A fetched fact names the vendor
 * that gave it, and a fact a vendor sent nothing for is a problem the page shows as a warning.
 */
export function holdingDetails(holding: Pick<HoldingFigures, 'instrument' | 'quantity' | 'valuation'>, sources: PortfolioSources, facts: FactsBook): HoldingDetails {
  const { instrument } = holding
  const { book } = sources
  const type = facts.typeOf(instrument)
  const fund = type === 'fund'
  const placeless = type === 'gold' || type === 'crypto'
  const vendor = PRICE_VENDORS.find((candidate) => candidate.id === instrument.prices)
  const exposures = FUND_MIXES.map((mix) => ({ mix, exposure: exposureOf(instrument, mix, book, facts) }))
  const spread = exposures.filter(({ exposure }) => exposure.lines.length >= 2).map(({ mix }) => mix)
  const unpriced = holding.quantity > DECIMAL_ZERO && holding.valuation === null
  const profile = type === 'share' ? facts.profileOf(instrument) : null
  const fundProfile = fund || type === null ? facts.fundProfileOf(instrument) : null
  const domicile = fund && instrument.isin !== null ? countryOfIsin(instrument.isin) : null
  const ter = fundTerOf(instrument, facts)
  const range = yearRange(instrument, sources)
  const fromProfile = profile === null ? '' : text.sources.profile(vendorName(profile.vendor))
  const fromFund = fundProfile === null ? '' : text.sources.fundProfile(vendorName(fundProfile.vendor))
  return {
    facts: [
      {
        label: text.type,
        value: type === null ? text.notKnown : words.types[type],
        caption: instrument.type !== null ? text.typed : type !== null && vendor !== undefined ? text.searched(vendor.name) : text.typeIt,
      },
      { label: text.class, value: words.classes[instrument.class], caption: text.typed },
      ...exposures.filter(({ exposure }) => !placeless || exposure.from !== null).map(({ mix, exposure }) => exposureFact(mix, exposure, book)),
      ...(domicile === null ? [] : [{ label: text.domicile, value: countryName(domicile), caption: text.sources.isin }]),
      ...(!placeless || instrument.isin !== null ? [{ label: text.isin, value: instrument.isin ?? text.notKnown, caption: instrument.isin === null ? text.typeIt : text.typed }] : []),
      ...exchangeFacts(instrument, profile?.exchange ?? null, fromProfile),
      ...(profile?.marketCap === undefined || profile.marketCap === null
        ? []
        : [
            {
              label: text.marketCap,
              value: text.about(formatCompactAmount(scaledDecimal(profile.marketCap.amount, MARKET_CAP_UNIT, 1n), profile.marketCap.currency)),
              caption: text.sources.approximate(vendorName(profile.vendor)),
            },
          ]),
      ...(profile?.ipo === undefined || profile.ipo === null ? [] : [{ label: text.ipo, value: dayLabel(profile.ipo), caption: fromProfile }]),
      ...(fund || ter !== null
        ? [
            {
              label: text.ter,
              value: ter === null ? text.notKnown : formatCostShare(Number(decimalText(ter.percent)) / 100),
              caption: ter === null ? text.typeIt : ter.vendor === null ? text.typed : text.sources.fundProfile(vendorName(ter.vendor)),
            },
          ]
        : []),
      ...(fundProfile?.netAssets === undefined || fundProfile.netAssets === null
        ? []
        : [{ label: text.fundSize, value: formatCompactAmount(fundProfile.netAssets, null), caption: text.sources.noCurrency(vendorName(fundProfile.vendor)) }]),
      ...(fundProfile?.inception === undefined || fundProfile.inception === null ? [] : [{ label: text.inception, value: dayLabel(fundProfile.inception), caption: fromFund }]),
      ...(fundProfile?.holdings === undefined || fundProfile.holdings === null
        ? []
        : [{ label: text.holdings, value: plural(text.holdingsCount(formatCount(fundProfile.holdings)), fundProfile.holdings), caption: text.sources.listed(vendorName(fundProfile.vendor)) }]),
      ...(fund || instrument.distribution !== null
        ? [
            {
              label: text.distribution,
              value: instrument.distribution === null ? text.notKnown : words.distributions[instrument.distribution],
              caption: instrument.distribution === null ? text.typeIt : text.typed,
            },
          ]
        : []),
      ...(range === null
        ? []
        : [
            {
              label: text.yearRange,
              value: text.rangeValue(formatUnitPrice(range.low.price, instrument.currency), formatUnitPrice(range.high.price, instrument.currency)),
              caption: range.ended
                ? text.rangeSpan(dayLabel(range.from), dayLabel(range.to))
                : !range.wholeYear
                  ? text.rangeSince(dayLabel(range.from))
                  : range.daily
                    ? text.rangeYear
                    : text.rangeMonthEnds,
            },
          ]),
      vendor === undefined
        ? { label: text.prices, value: words.instrumentDialog.manual, caption: text.typed }
        : { label: text.prices, value: vendor.name, caption: text.atSource(instrument.sourceSymbol) },
    ],
    rings: holding.valuation === null ? [] : spread,
    ringsWaitFor: fund && spread.length === 0 ? 'mix' : spread.length > 0 && unpriced ? 'price' : null,
    leveraged: fundProfile?.leveraged === true ? text.leveraged(vendorName(fundProfile.vendor)) : null,
    problems: holding.quantity > DECIMAL_ZERO ? factWarning(facts.problemsOf(instrument)) : null,
  }
}

/** The warning of a holding's fact problems, or null for none. A sold holding is asked about no more, so it gets none. */
function factWarning(problems: readonly FactProblem[]): FactWarning | null {
  if (problems.length === 0) {
    return null
  }
  const askedOn = problems.map((problem) => problem.askedOn).reduce((earliest, day) => (day < earliest ? day : earliest))
  const asksAgainOn = problems.map((problem) => addDays(problem.askedOn, daysBeforeAskedAgain(problem.failure))).reduce((soonest, day) => (day < soonest ? day : soonest))
  return {
    sentences: problems.map(problemSentence),
    vendors: [...new Set(problems.map((problem) => problem.vendor))].map((id) => ({ id, name: vendorName(id) })),
    askedOn,
    asksAgainOn,
  }
}

/** The exchange its company profile names, for an instrument typed with none, as the page's header already names a typed one. */
function exchangeFacts(instrument: Instrument, profiled: string | null, fromProfile: string): Fact[] {
  return instrument.exchange !== null || profiled === null ? [] : [{ label: text.exchange, value: profiled, caption: fromProfile }]
}

/** What a vendor sent for a fact, in plain words, such as "Alpha Vantage sent no fund profile for VWCE.DEX". */
function problemSentence(problem: FactProblem): string {
  const vendor = vendorName(problem.vendor)
  const what = text.problems.facts[problem.fact]
  switch (problem.failure) {
    case 'empty':
      return text.problems.empty(vendor, what, problem.asked)
    case 'unknown-symbol':
      return text.problems.unknown(vendor, problem.asked)
    case 'unreadable':
      return text.problems.unreadable(vendor, what, problem.asked)
    case 'message':
      return text.problems.message(vendor, problem.fact, problem.asked)
    default:
      return text.problems.refused(vendor, what, problem.asked, text.problems.reasons[problem.failure])
  }
}

/** Where a sector or a country came from, a fetched one naming the vendor that gave it. */
function sourceCaption(source: ExposureSource): string {
  if (source.kind === 'fund-weights' || source.kind === 'profile') {
    const vendor = vendorName(source.vendor)
    return source.kind === 'profile' ? text.sources.profile(vendor) : text.sources.fundWeights(vendor)
  }
  return { 'fund-mix': text.sources.fundMix, typed: text.typed, isin: text.sources.isin }[source.kind]
}

function exposureFact(mix: ExposureMix, exposure: HoldingExposure<ExposureMix>, book: InvestmentBook): Fact {
  const [first, second] = exposure.lines
  const label = mix === 'sector' ? text.sector : text.country
  if (exposure.from === null || first === undefined) return { label, value: text.notKnown, caption: text.typeIt }
  const count = exposure.lines.length
  return { label, value: second === undefined ? groupName(mix, first.group, book) : plural(text.spread[mix](count), count), caption: sourceCaption(exposure.from) }
}
