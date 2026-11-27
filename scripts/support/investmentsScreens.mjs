/**
 * The visual check's Investments screens, with the figures they must show, worked out from the fake portfolio with the
 * same domain functions the screens use.
 */

import { holdingReturn } from '../../src/apps/investments/holdings/domain/holding.ts'
import { holdingMix, holdingMixes } from '../../src/apps/investments/holdings/domain/holdingMix.ts'
import { holdingDetails } from '../../src/apps/investments/holdings/presentation/holdingDetails.ts'
import { holdingsList } from '../../src/apps/investments/holdings/domain/holdingsList.ts'
import { targetGaps } from '../../src/apps/investments/holdings/domain/targetMix.ts'
import { latestRecords } from '../../src/apps/investments/holdings/domain/latestRecords.ts'
import { figuresClose, portfolioFigures } from '../../src/apps/investments/holdings/domain/portfolioFigures.ts'
import { averageCostText } from '../../src/apps/investments/holdings/presentation/holdingText.ts'
import { incomeForecast } from '../../src/apps/investments/income/domain/incomeForecast.ts'
import { fetchedFactsBook } from '../../src/apps/investments/prices/domain/factsBook.ts'
import { FAKE_KEY_SAVED_AT } from '../../src/shared/secrets/infrastructure/fake/fakeSecrets.ts'
import { incomeByYear } from '../../src/apps/investments/income/domain/incomeHistory.ts'
import { investingRhythm } from '../../src/apps/investments/income/domain/investingRhythm.ts'
import { foreignIncomeYear } from '../../src/apps/investments/tax/domain/foreignIncome.ts'
import { taxFreeCalendar } from '../../src/apps/investments/tax/domain/taxFreeCalendar.ts'
import { taxReminder } from '../../src/apps/investments/tax/domain/taxReminders.ts'
import { capitalGainsYear } from '../../src/apps/investments/tax/domain/taxYear.ts'
import { recentCosts, yearlyCosts } from '../../src/apps/investments/income/domain/yearlyCosts.ts'
import { incomeAgainstLastYear } from '../../src/apps/investments/overview/domain/overviewFigures.ts'
import { gainSources } from '../../src/apps/investments/holdings/domain/gainSources.ts'
import { portfolioChecks } from '../../src/apps/investments/checks/domain/portfolioChecks.ts'
import { checkLines } from '../../src/apps/investments/checks/presentation/checkLines.ts'
import { benchmarkState, comparedBenchmark } from '../../src/apps/investments/performance/domain/benchmark.ts'
import { monthlyReturns } from '../../src/apps/investments/performance/domain/monthlyReturns.ts'
import { periodGains } from '../../src/apps/investments/performance/domain/periodGains.ts'
import { dayValuer, portfolioPerformance } from '../../src/apps/investments/performance/domain/portfolioPerformance.ts'
import { underwater } from '../../src/apps/investments/performance/domain/underwater.ts'
import { pricesFileBook, pricesFileRateBook } from '../../src/apps/investments/prices/domain/pricesFileBooks.ts'
import { fakePricesFile } from '../../src/apps/investments/prices/infrastructure/fake/fakePrices.ts'
import { fakeInvestmentsDocument } from '../../src/apps/investments/workbook/infrastructure/fake/fakeInvestments.ts'
import { INVESTMENTS_DOCUMENT } from '../../src/apps/investments/workbook/infrastructure/investmentsDocument.ts'
import { dayLabel, shortDayLabel, weekdayDayLabel } from '../../src/shared/calendar/dayLabel.ts'
import { formatMoney, formatPercent, formatPercentChange } from '../../src/shared/money/moneyFormat.ts'
import { MADE_UP_ANTHROPIC_KEY } from './chatFlows.mjs'
import { CROATIAN_MONEY, INVESTMENTS_DAY } from './visualCommon.mjs'

/**
 * The made-up portfolio's figures on the Overview and the home card, worked out with the same domain functions the
 * screens use, as `?investments=` and `?prices=` name the fake sets. Money comes in English and in Croatian.
 */
function fakeInvestmentsShows(variant, pricesVariant) {
  const { workbook, rates, figures } = fakePortfolio(variant, pricesVariant)
  const income = incomeAgainstLastYear(workbook.book, INVESTMENTS_DAY)
  const sources = gainSources(figures)
  const newestFlow = latestRecords(workbook.book, rates, 5).find((entry) => entry.kind === 'trade' || entry.kind === 'income' || entry.kind === 'cash-movement')
  return {
    close: weekdayDayLabel(figuresClose(figures)),
    newestShort: shortDayLabel(figuresClose(figures)),
    english: [
      formatMoney(figures.value),
      formatMoney(figures.totalGain, 'always'),
      `${formatPercent(figures.totalGainShare, 'always')} on the ${formatMoney(figures.putIn)} you put in`,
      formatMoney(income.thisYear),
      ...(figures.lastDay?.share == null ? [] : [formatPercentChange(figures.lastDay.share)]),
      ...(newestFlow === undefined ? [] : [formatMoney(newestFlow.euros, 'always')]),
    ],
    croatian: [formatMoney(figures.value, 'negative', CROATIAN_MONEY), formatMoney(figures.totalGain, 'always', CROATIAN_MONEY), formatMoney(figures.putIn, 'negative', CROATIAN_MONEY)],
    tradingFees: formatMoney(sources.tradingFees),
    home: [formatMoney(figures.value), formatMoney(figures.totalGain, 'always')],
    homeCroatian: [formatMoney(figures.value, 'negative', CROATIAN_MONEY), formatMoney(figures.totalGain, 'always', CROATIAN_MONEY)],
    ...homeBadge(workbook.book, rates, figuresClose(figures)),
  }
}

/** The home card's badge on the check's day: the nearest tax date, or else the late prices, in English in full and in Croatian by its first words. */
function homeBadge(book, rates, newestClose) {
  const reminder = taxReminder(book, rates, INVESTMENTS_DAY)
  if (reminder === null) {
    return { badge: `Prices from ${shortDayLabel(newestClose)}`, badgeCroatian: 'Cijene od' }
  }
  const day = shortDayLabel(reminder.due)
  switch (reminder.kind) {
    case 'ino-doh':
      return { badge: `INO-DOH by ${day}`, badgeCroatian: 'INO-DOH do' }
    case 'joppd':
      return { badge: `JOPPD by ${day}`, badgeCroatian: 'JOPPD do' }
    case 'payments':
      return { badge: reminder.count === 1 ? `Tax on 1 payment by ${day}` : `Tax on ${reminder.count} payments by ${day}`, badgeCroatian: 'Porez na' }
  }
}

/** The made-up Investments file and its figures on the fake build's day, as `?investments=` and `?prices=` name them. */
export function fakePortfolio(variant, pricesVariant) {
  const at = `${INVESTMENTS_DAY}T09:00:00.000Z`
  const { workbook } = INVESTMENTS_DOCUMENT.read({ meta: { id: 'visual', source: 'browser', title: 'visual', syncedAt: at }, document: fakeInvestmentsDocument(at, variant) })
  const prices = fakePricesFile(pricesVariant, INVESTMENTS_DAY)
  const rates = pricesFileRateBook(prices)
  const figures = portfolioFigures({ book: workbook.book, prices: pricesFileBook(prices, workbook.book.prices), rates, today: INVESTMENTS_DAY })
  return { workbook, rates, figures }
}

/** The sample's Holdings figures: the value, the holdings' cost and their gain, in English and in Croatian. */
function fakeHoldingsShows() {
  const { workbook, figures } = fakePortfolio('sample', 'sample')
  const { total } = holdingsList(figures, workbook.book, { grouping: 'class', withCash: true, find: '', sort: null })
  return {
    english: [formatMoney(total.value), formatMoney(total.cost), formatMoney(total.gain, 'always')],
    croatian: [formatMoney(total.value, 'negative', CROATIAN_MONEY), formatMoney(total.cost, 'negative', CROATIAN_MONEY), formatMoney(total.gain, 'always', CROATIAN_MONEY)],
  }
}

/** Example Tech of the sample, in US dollars with its first lot partly sold, and Example Spinco, received in a spin-off, split two for one and priced by hand. */
export const SAMPLE_SHARE_A = 'fa4e1000-0000-4000-8000-000000000010'
const SAMPLE_SPIN_CO = 'fa4e1000-0000-4000-8000-000000000014'
/** The sample's World ETF, accumulating, with its own mix by sector and by country, and its Index Fund, never bought, with no mix. */
export const SAMPLE_WORLD_ETF = 'fa4e1000-0000-4000-8000-000000000012'
const SAMPLE_INDEX_FUND = 'fa4e1000-0000-4000-8000-000000000015'
/** The sample's Example Dividend Co, whose company profile Finnhub refused, and its Money Fund, with a whole fund profile from Alpha Vantage and no TER typed. */
const SAMPLE_SHARE_B = 'fa4e1000-0000-4000-8000-000000000011'
const SAMPLE_MONEY_FUND = 'fa4e1000-0000-4000-8000-000000000013'
/** The sample's Example Retired Co, sold in full, with prices from a year before its first buy. */
export const SAMPLE_RETIRED_CO = 'fa4e1000-0000-4000-8000-000000000016'

/** A sample holding's page: its name, its value, its total return and its average cost, in English and in Croatian. */
function fakeHoldingShows(key) {
  const { figures } = fakePortfolio('sample', 'sample')
  const holding = figures.holdings.find((entry) => entry.instrument.id === `instrument:${key}`)
  const returns = holdingReturn(holding)
  return {
    name: holding.instrument.name,
    english: [formatMoney(holding.valuation.value), formatMoney(returns.total, 'always'), averageCostText(holding)],
    croatian: [formatMoney(holding.valuation.value, 'negative', CROATIAN_MONEY), formatMoney(returns.total, 'always', CROATIAN_MONEY)],
  }
}

const SAMPLE_HOLDINGS = fakeHoldingsShows()

/** The sample's sources and the facts its fake prices file holds, as Holdings and the Overview read them. */
function fakeSources() {
  const { workbook, rates, figures } = fakePortfolio('sample', 'sample')
  const prices = fakePricesFile('sample', INVESTMENTS_DAY)
  const sources = { book: workbook.book, prices: pricesFileBook(prices, workbook.book.prices), rates, today: INVESTMENTS_DAY }
  return { book: workbook.book, sources, figures, facts: fetchedFactsBook(prices.facts) }
}

/** The gap of each group of the sample's target mix, in English and in Croatian. */
function fakeTargetsShows() {
  const { book, figures, facts } = fakeSources()
  const mix = holdingMix(figures, book, facts, book.targets[0].slice.mix)
  const gaps = targetGaps(mix, book.targets).map((line) => line.gap)
  return { english: gaps.map((gap) => formatMoney(gap, 'always')), croatian: gaps.map((gap) => formatMoney(gap, 'always', CROATIAN_MONEY)) }
}

/** The sentences of the sample's portfolio checks, as the Overview lists them in English. */
function fakeChecksShows() {
  const { book, sources, figures, facts } = fakeSources()
  const checks = portfolioChecks(figures, holdingMixes(figures, book, facts), recentCosts(sources, dayValuer(sources), facts), book.targets, book.checks)
  return checkLines(checks, book).map((line) => line.sentence)
}

/** The values and captions of a sample holding's Details card in English, with its warnings, as the fake prices file's facts give them. */
function fakeDetailsShows(key) {
  const { sources, figures, facts } = fakeSources()
  const holding = figures.holdings.find((entry) => entry.instrument.id === `instrument:${key}`)
  const details = holdingDetails(holding, sources, facts)
  return [
    ...details.facts.flatMap((fact) => [fact.value, ...(fact.caption === undefined ? [] : [fact.caption])]),
    ...(details.problems?.sentences ?? []),
    ...(details.leveraged === null ? [] : [details.leveraged]),
  ]
}

const SAMPLE_TARGETS = fakeTargetsShows()
const SAMPLE_CHECKS = fakeChecksShows()

/** A past close for Holdings' `?on=`, after the World ETF's buys and the retired share's sale. */
const HOLDINGS_PAST_DAY = '2025-12-31'

/** The close of the first late holding when the fake prices stop four weekdays back, as Holdings marks it. */
const LATE_HOLDING_CLOSE = dayLabel(fakePortfolio('sample', 'late-prices').figures.holdings.find((holding) => holding.late).valuation.close.date)
export const SAMPLE_SHARE_A_PAGE = fakeHoldingShows(SAMPLE_SHARE_A)
const SAMPLE_SPIN_CO_PAGE = fakeHoldingShows(SAMPLE_SPIN_CO)

/**
 * Performance over a period of a fake set, everything unless named, worked out as the screen works it out: the
 * time-weighted return and its rate a year, the money-weighted rate, and with a benchmark its own return, the difference
 * and the same money in it beside the portfolio's value.
 */
function fakePerformanceShows(variant, pricesVariant, period = { kind: 'all' }) {
  const { workbook, rates } = fakePortfolio(variant, pricesVariant)
  const prices = fakePricesFile(pricesVariant, INVESTMENTS_DAY)
  const sources = { book: workbook.book, prices: pricesFileBook(prices, workbook.book.prices), rates, today: INVESTMENTS_DAY }
  const performance = portfolioPerformance(sources, comparedBenchmark(benchmarkState(sources), workbook.book, prices.splits), period)
  const { timeWeighted, moneyWeighted, value } = performance.portfolio
  const comparison = performance.benchmark
  return {
    english: [
      `From ${dayLabel(performance.from)} to ${dayLabel(performance.to)}.`,
      formatPercentChange(timeWeighted.total),
      ...(timeWeighted.yearly === null ? [] : [`time-weighted, ${formatPercentChange(timeWeighted.yearly)} a year`]),
      ...(moneyWeighted.kind === 'rate' ? [formatPercentChange(moneyWeighted.rate)] : []),
      ...(comparison === null
        ? []
        : [
            formatPercentChange(comparison.priceReturn.total),
            formatPercentChange(comparison.difference),
            `${formatMoney(comparison.replay.value)} against your ${formatMoney(value)}`,
            `You are ${formatMoney(comparison.valueDifference, 'magnitude')} ${comparison.valueDifference < 0 ? 'behind' : 'ahead'}`,
          ]),
    ],
    croatian:
      comparison === null
        ? []
        : [
            formatMoney(value, 'negative', CROATIAN_MONEY),
            formatMoney(comparison.replay.value, 'negative', CROATIAN_MONEY),
            `${comparison.valueDifference < 0 ? 'Zaostajete' : 'Ispred ste'} ${formatMoney(comparison.valueDifference, 'magnitude', CROATIAN_MONEY)}`,
          ],
  }
}

/**
 * Performance's other tabs on the sample, worked out as the screen works them out: the first year's chained return on
 * Months, the price and currency totals of the currency effect over everything and over the last year on Sources, and
 * the deepest fall below a peak on Falls, which the risk card beside it shows as the largest fall.
 */
function fakePerformanceTabsShows() {
  const { workbook, rates } = fakePortfolio('sample', 'sample')
  const prices = fakePricesFile('sample', INVESTMENTS_DAY)
  const sources = { book: workbook.book, prices: pricesFileBook(prices, workbook.book.prices), rates, today: INVESTMENTS_DAY }
  const compared = comparedBenchmark(benchmarkState(sources), workbook.book, prices.splits)
  const valuedOn = dayValuer(sources)
  const everything = portfolioPerformance(sources, compared, { kind: 'all' }, valuedOn)
  const lastYear = portfolioPerformance(sources, compared, { kind: 'years', years: 1 }, valuedOn)
  const totals = (performance, format) => {
    const gains = periodGains(sources, performance, valuedOn)
    return [formatMoney(gains.start, 'negative', format), formatMoney(gains.end, 'negative', format), formatMoney(gains.price, 'always', format), formatMoney(gains.currency, 'always', format)]
  }
  return {
    months: formatPercentChange(monthlyReturns(everything.growth)[0].portfolio),
    sources: totals(everything),
    sourcesCroatian: totals(everything, CROATIAN_MONEY),
    sourcesLastYear: totals(lastYear),
    deepest: formatPercentChange(underwater(everything.growth).deepest),
  }
}

/**
 * The sample's income tabs on Performance, worked out as the tabs work them out: the newest year's income received,
 * what the next twelve months should bring and the day the soonest lot turns tax-free with its value now.
 */
function fakeIncomeShows() {
  const { workbook, rates, figures } = fakePortfolio('sample', 'sample')
  const prices = fakePricesFile('sample', INVESTMENTS_DAY)
  const sources = { book: workbook.book, prices: pricesFileBook(prices, workbook.book.prices), rates, today: INVESTMENTS_DAY }
  const [newestYear] = incomeByYear(workbook.book, INVESTMENTS_DAY)
  const coming = incomeForecast(sources, fetchedFactsBook(prices.facts)).received
  const [soonest] = taxFreeCalendar(figures, INVESTMENTS_DAY).flatMap((month) => month.lots)
  const [newestCosts] = yearlyCosts(sources, dayValuer(sources), fetchedFactsBook(prices.facts))
  const rhythm = investingRhythm(workbook.book, INVESTMENTS_DAY)
  return {
    income: [formatMoney(newestYear.total.received)],
    incomeCroatian: [formatMoney(newestYear.total.received, 'negative', CROATIAN_MONEY)],
    coming: [`About ${formatMoney(coming)} in the next 12 months`],
    comingCroatian: [`Oko ${formatMoney(coming, 'negative', CROATIAN_MONEY)} u sljedećih 12 mjeseci`],
    taxFree: [`tax-free from ${dayLabel(soonest.lot.taxFreeFrom)}`, formatMoney(soonest.value)],
    taxFreeCroatian: [formatMoney(soonest.value, 'negative', CROATIAN_MONEY)],
    costs: [formatMoney(newestCosts.total)],
    costsCroatian: [formatMoney(newestCosts.total, 'negative', CROATIAN_MONEY)],
    saving: [formatMoney(rhythm.averageMonth)],
    savingCroatian: [formatMoney(rhythm.averageMonth, 'negative', CROATIAN_MONEY)],
  }
}

const SAMPLE_PERFORMANCE = fakePerformanceShows('sample', 'sample')
const SAMPLE_PERFORMANCE_TABS = fakePerformanceTabsShows()
const SAMPLE_INCOME = fakeIncomeShows()

/** The sample's 2026 on the Tax screen, worked out as the screen works it out, in English and in Croatian. */
function fakeTaxShows() {
  const { workbook, rates } = fakePortfolio('sample', 'sample')
  const gains = capitalGainsYear(workbook.book, rates, 2026)
  const foreign = foreignIncomeYear(workbook.book, rates, 2026)
  const both = (cents, sign = 'negative') => [formatMoney(cents, sign), formatMoney(cents, sign, CROATIAN_MONEY)]
  const [tax, taxCroatian] = both(gains.tax)
  const [free, freeCroatian] = both(gains.taxFreeGains)
  const saleGains = gains.sales.map((sale) => both(sale.gain, 'always'))
  const [left, leftCroatian] = both(foreign.joppd.leftToPay)
  return {
    year: [tax, free, gains.reportMark],
    yearCroatian: [taxCroatian, freeCroatian, gains.reportMark],
    sales: saleGains.map(([english]) => english),
    salesCroatian: saleGains.map(([, croatian]) => croatian),
    foreign: [left],
    foreignCroatian: [leftCroatian],
  }
}

const SAMPLE_TAX = fakeTaxShows()
const YOUNG_PERFORMANCE = fakePerformanceShows('young', 'sample')
const NO_BENCHMARK_PERFORMANCE = fakePerformanceShows('sample', 'no-benchmark')
const YEAR_PERFORMANCE = fakePerformanceShows('sample', 'sample', { kind: 'year', year: 2024 })

export const SAMPLE_INVESTMENTS = fakeInvestmentsShows('sample', 'sample')
export const LATE_INVESTMENTS = fakeInvestmentsShows('sample', 'late-prices')
const CASH_BELOW_ZERO_INVESTMENTS = fakeInvestmentsShows('cash-below-zero', 'sample')

export const investmentsScreens = [
  {
    name: 'investments-settings-assist',
    query: 'investments=sample',
    hash: '#/investments/settings?tab=assistant',
    title: 'Settings',
    charts: 0,
    ready: '[data-testid="assist-allowed"][data-allowed="false"]',
    stored: { 'kuna.secret.anthropic': MADE_UP_ANTHROPIC_KEY },
    shows: [
      'Uses your Anthropic key, straight from this browser.',
      'Kuna asks once in each chat before it reads your records and sends to Anthropic.',
      'records and figures from Investments the chat asks for',
    ],
    cards: false,
  },
  {
    name: 'investments-settings-assist-croatian',
    query: 'investments=sample&lang=hr',
    hash: '#/investments/settings?tab=assistant',
    title: 'Postavke',
    charts: 0,
    ready: '[data-testid="assist-allowed"][data-allowed="false"]',
    stored: { 'kuna.secret.anthropic': MADE_UP_ANTHROPIC_KEY },
    shows: [
      'Koristi vaš ključ za Anthropic, izravno iz ovog preglednika.',
      'Kuna jednom u svakom razgovoru pita prije nego što pročita vaše zapise i pošalje ih tvrtki Anthropic.',
      'zapisi i iznosi iz aplikacije Ulaganja',
    ],
    cards: false,
  },
]

export const investmentsSourceScreens = [
  {
    name: 'investments-start',
    hash: '#/investments',
    title: 'Investments',
    charts: 0,
    shows: ['Where the Investments file lives', 'A new file on Google Drive', 'My file on Google Drive'],
    cards: false,
  },
  {
    name: 'investments-start-croatian',
    query: 'lang=hr',
    hash: '#/investments',
    title: 'Ulaganja',
    charts: 0,
    shows: ['Gdje se čuva datoteka ulaganja', 'Nova datoteka na Google Driveu', 'Moja datoteka na Google Driveu'],
    cards: false,
  },
  {
    name: 'investments-overview',
    query: 'investments=drive',
    hash: '#/investments',
    title: 'Overview',
    charts: 0,
    shows: ['No transactions yet', 'Add what I hold now', 'Import my full history', 'on Google Drive as kuna-investments.json'],
    cards: false,
  },
  {
    name: 'investments-overview-croatian',
    query: 'investments=drive&lang=hr',
    hash: '#/investments',
    title: 'Pregled',
    charts: 0,
    shows: ['Još nema transakcija', 'Dodaj što držim', 'Uvezi cijelu povijest', 'na Google Driveu kao kuna-investments.json'],
    cards: false,
  },
  { name: 'investments-opening', query: 'investments=opening', hash: '#/investments', title: 'Overview', charts: 0, ready: '[data-testid="investments-loading"]', cards: false },
  {
    name: 'investments-opening-croatian',
    query: 'investments=opening&lang=hr',
    hash: '#/investments',
    title: 'Pregled',
    charts: 0,
    ready: '[data-testid="investments-loading"]',
    cards: false,
  },
  {
    name: 'investments-settings',
    query: 'investments=drive',
    hash: '#/investments/settings',
    title: 'Settings',
    charts: 0,
    ready: '[data-testid="investments-books-card"] [data-testid="drive-file-place"] a',
    shows: ['Investments books', 'kuna-investments.json', 'Switch storage'],
  },
  {
    name: 'investments-settings-croatian',
    query: 'investments=drive&lang=hr',
    hash: '#/investments/settings',
    title: 'Postavke',
    charts: 0,
    ready: '[data-testid="investments-books-card"] [data-testid="drive-file-place"] a',
    shows: ['Datoteka ulaganja', 'kuna-investments.json', 'Promijeni mjesto', 'Zadnja sinkronizacija'],
  },
  {
    name: 'investments-overview-sample',
    query: 'investments=sample',
    hash: '#/investments',
    title: 'Overview',
    charts: 1,
    shows: [
      `At the close of ${SAMPLE_INVESTMENTS.close}.`,
      'Prices entered by hand',
      'Example Money Fund (EMF) uses the price you entered on',
      ...SAMPLE_INVESTMENTS.english,
      'Last day',
      'What you hold',
      'Each holding, with how it moved on the day',
      'All holdings',
      'Value over time',
      'Latest transactions',
      'Stock lending',
    ],
    lacks: ['Portfolio checks', 'Where the money is', 'Movers on the last day', 'Where the gain comes from'],
  },
  {
    name: 'investments-overview-sample-croatian',
    query: 'investments=sample&lang=hr',
    hash: '#/investments',
    title: 'Pregled',
    charts: 1,
    shows: ['Stanje na zatvaranju:', 'Cijene unesene ručno', ...SAMPLE_INVESTMENTS.croatian, 'Zadnji dan', 'Što držite', 'Sve pozicije', 'Vrijednost kroz vrijeme', 'Zadnje transakcije'],
    lacks: ['Provjere portfelja', 'Gdje je novac'],
  },
  {
    name: 'investments-overview-cash-below-zero',
    query: 'investments=cash-below-zero',
    hash: '#/investments',
    title: 'Overview',
    charts: 1,
    shows: ['Some figures need a look', 'Broker Two holds −€', 'of cash, below zero. A deposit or an exchange is probably missing.', ...CASH_BELOW_ZERO_INVESTMENTS.english],
  },
  {
    name: 'investments-overview-cash-below-zero-croatian',
    query: 'investments=cash-below-zero&lang=hr',
    hash: '#/investments',
    title: 'Pregled',
    charts: 1,
    shows: ['Neke brojke treba provjeriti', 'Broker Two: novac je −', 'ispod nule. Vjerojatno nedostaje uplata ili konverzija.', ...CASH_BELOW_ZERO_INVESTMENTS.croatian],
  },
  {
    name: 'investments-holdings',
    query: 'investments=sample',
    hash: '#/investments/holdings',
    title: 'Holdings',
    charts: 1,
    expandedBefore: ['holdings.map'],
    ready: '[data-testid="holdings"] [data-testid="holding-row"], [data-testid="holdings-table"]',
    shows: [
      'holdings and the cash, worth',
      'Mix',
      'By sector',
      'By class',
      'Other and not known',
      '1 holding has no sector yet:',
      'Example Tech',
      'Example World ETF',
      'Example Money Fund',
      'Stocks',
      'Money market',
      'Cash and currencies',
      'Broker Two',
      'Total',
      'Closed positions',
      'Example Retired Co',
      'Where the gain comes from',
      `Trading fees of ${SAMPLE_INVESTMENTS.tradingFees} are inside these figures.`,
      'Map of holdings',
      'Size is the value, colour the gain on what you hold',
      'Gain of 10 to 25%',
      'Target mix',
      'Portfolio checks',
      'Change the thresholds',
      ...SAMPLE_CHECKS,
      'Fetched facts',
      'Vendors sent nothing usable for 2 holdings:',
      'Example Dividend Co',
      ...SAMPLE_HOLDINGS.english,
    ],
  },
  {
    name: 'investments-holdings-croatian',
    query: 'investments=sample&lang=hr',
    hash: '#/investments/holdings',
    title: 'Pozicije',
    charts: 1,
    expandedBefore: ['holdings.map'],
    ready: '[data-testid="holdings"] [data-testid="holding-row"], [data-testid="holdings-table"]',
    shows: [
      'pozicija i novac, vrijednost',
      'Raspodjela',
      'Po sektoru',
      'Po klasi',
      'Ostalo i nepoznato',
      '1 pozicija još nema sektor:',
      'Dionice',
      'Novčani fondovi',
      'Novac i valute',
      'Ukupno',
      'Zatvorene pozicije',
      'Odakle dolazi dobit',
      'Karta pozicija',
      'Veličina je vrijednost, boja dobit na onome što držite',
      'Ciljna raspodjela',
      'Provjere portfelja',
      'Iznad praga',
      'Promijeni pragove',
      'Dohvaćeni podaci',
      'Izvori nisu poslali ništa upotrebljivo za 2 pozicije:',
      ...SAMPLE_HOLDINGS.croatian,
    ],
  },
  {
    name: 'investments-holdings-split-class',
    query: 'investments=sample',
    hash: '#/investments/holdings?split=class',
    title: 'Holdings',
    charts: 1,
    expandedBefore: ['holdings.map'],
    ready: '[data-mix="class"] .donut-ring canvas',
    shows: ['Mix', 'By class', 'Stocks', 'Money market', 'Cash and currencies', 'value'],
  },
  {
    name: 'investments-holdings-split-class-croatian',
    query: 'investments=sample&lang=hr',
    hash: '#/investments/holdings?split=class',
    title: 'Pozicije',
    charts: 1,
    expandedBefore: ['holdings.map'],
    ready: '[data-mix="class"] .donut-ring canvas',
    shows: ['Raspodjela', 'Po klasi', 'Dionice', 'Novčani fondovi', 'Novac i valute', 'vrijednost'],
  },
  {
    name: 'investments-holdings-split-country',
    query: 'investments=sample',
    hash: '#/investments/holdings?split=country&group=currency',
    title: 'Holdings',
    charts: 1,
    expandedBefore: ['holdings.map'],
    ready: '[data-mix="country"] .donut-ring canvas',
    shows: ['Mix', 'By country or region', 'United States', 'of holdings', 'By currency', 'USD', 'cash balance'],
  },
  {
    name: 'investments-holdings-split-country-croatian',
    query: 'investments=sample&lang=hr',
    hash: '#/investments/holdings?split=country&group=currency',
    title: 'Pozicije',
    charts: 1,
    expandedBefore: ['holdings.map'],
    ready: '[data-mix="country"] .donut-ring canvas',
    shows: ['Raspodjela', 'Po državi ili regiji', 'u pozicijama', 'Po valuti', 'USD', 'novčan'],
  },
  {
    name: 'investments-holdings-targets',
    query: 'investments=sample',
    hash: '#/investments/holdings',
    title: 'Holdings',
    charts: 1,
    expandedBefore: ['holdings.map', 'holdings.targets'],
    ready: '[data-testid="targets-table"]',
    shows: ['Target mix', 'By class', 'Set targets', 'Group', 'Target', 'Gap', 'If you put in', 'Splits it over what each group lacks', 'Stocks', 'Money market', ...SAMPLE_TARGETS.english],
  },
  {
    name: 'investments-holdings-targets-croatian',
    query: 'investments=sample&lang=hr',
    hash: '#/investments/holdings',
    title: 'Pozicije',
    charts: 1,
    expandedBefore: ['holdings.map', 'holdings.targets'],
    ready: '[data-testid="targets-table"]',
    shows: ['Ciljna raspodjela', 'Po klasi', 'Postavi ciljeve', 'Skupina', 'Cilj', 'Razlika', 'Ako uplatite', 'Dionice', 'Novčani fondovi', ...SAMPLE_TARGETS.croatian],
  },
  {
    name: 'investments-holdings-on-date',
    query: 'investments=sample',
    hash: `#/investments/holdings?on=${HOLDINGS_PAST_DAY}`,
    title: 'Holdings',
    charts: 1,
    expandedBefore: ['holdings.map'],
    ready: '[data-testid="holdings"] [data-testid="holding-row"], [data-testid="holdings-table"]',
    shows: [`Holdings at the close of ${dayLabel(HOLDINGS_PAST_DAY)}`, 'Today', 'By sector', 'Example World ETF', 'Closed positions', 'Example Retired Co'],

    lacks: ['Portfolio checks'],
  },
  {
    name: 'investments-holdings-on-date-croatian',
    query: 'investments=sample&lang=hr',
    hash: `#/investments/holdings?on=${HOLDINGS_PAST_DAY}`,
    title: 'Pozicije',
    charts: 1,
    expandedBefore: ['holdings.map'],
    ready: '[data-testid="holdings"] [data-testid="holding-row"], [data-testid="holdings-table"]',
    shows: ['Pozicije na zatvaranju', 'Na dan', 'Danas', 'Po sektoru', 'Zatvorene pozicije'],
  },
  {
    name: 'investments-holdings-late',
    query: 'investments=sample&prices=late-prices',
    hash: '#/investments/holdings',
    title: 'Holdings',
    charts: 1,
    expandedBefore: ['holdings.map'],
    ready: '[data-testid="holdings"] [data-testid="holding-row"], [data-testid="holdings-table"]',
    shows: [`Close of ${LATE_HOLDING_CLOSE}, late`, 'Example Tech'],
  },
  {
    name: 'investments-holdings-late-croatian',
    query: 'investments=sample&prices=late-prices&lang=hr',
    hash: '#/investments/holdings',
    title: 'Pozicije',
    charts: 1,
    expandedBefore: ['holdings.map'],
    ready: '[data-testid="holdings"] [data-testid="holding-row"], [data-testid="holdings-table"]',
    shows: ['Zaključna cijena od', 'kasni', 'Example Tech'],
  },
  {
    name: 'investments-holding-usd',
    query: 'investments=sample',
    hash: `#/investments/holding?instrument=${SAMPLE_SHARE_A}`,
    title: SAMPLE_SHARE_A_PAGE.name,
    charts: 1,
    shows: [
      'quoted in USD',
      'first bought',
      'Total return',
      'Price',
      'Currency',
      'Realised on sales',
      'Average cost',
      'Tax-free',
      'Lots still held',
      'Transactions',
      'Sell',
      'Buy',
      'Sale',
      ...SAMPLE_SHARE_A_PAGE.english,
      'Market cap',
      'Listed since',
      '52-week range',
      'From Finnhub, approximate',
      ...fakeDetailsShows(SAMPLE_SHARE_A),
    ],
    cards: false,
  },
  {
    name: 'investments-holding-usd-croatian',
    query: 'investments=sample&lang=hr',
    hash: `#/investments/holding?instrument=${SAMPLE_SHARE_A}`,
    title: SAMPLE_SHARE_A_PAGE.name,
    charts: 1,
    shows: [
      'kotira u USD',
      'Ukupni prinos',
      'Tečaj',
      'Ostvareno prodajom',
      'Prosječna nabavna cijena',
      'Bez poreza',
      'Kupnje koje još držite',
      'Transakcije',
      'Kupnja',
      'Prodaja',
      ...SAMPLE_SHARE_A_PAGE.croatian,
      'Tržišna kapitalizacija',
      'Na burzi od',
      'Raspon u 52 tjedna',
      'Iz izvora Finnhub, približno',
    ],
    cards: false,
  },
  {
    name: 'investments-holding-split',
    query: 'investments=sample',
    hash: `#/investments/holding?instrument=${SAMPLE_SPIN_CO}`,
    title: SAMPLE_SPIN_CO_PAGE.name,
    charts: 1,
    shows: [
      'Price entered by hand on',
      'Split',
      '2 for 1',
      'Spin-off',
      'received from Example Dividend Co',
      'from a spin-off on',
      'Lots still held',
      'Details',
      'Not known',
      'Type it with Change',
      'Company profile from Finnhub',
      'Exchange',
      'NEW YORK STOCK EXCHANGE, INC.',
      'Entered by hand',
      ...SAMPLE_SPIN_CO_PAGE.english,
    ],
    cards: false,
  },
  {
    name: 'investments-holding-split-croatian',
    query: 'investments=sample&lang=hr',
    hash: `#/investments/holding?instrument=${SAMPLE_SPIN_CO}`,
    title: SAMPLE_SPIN_CO_PAGE.name,
    charts: 1,
    shows: [
      'Cijena unesena ručno',
      'Podjela',
      '2 za 1',
      'Izdvajanje',
      'primljeno iz: Example Dividend Co',
      'iz izdvajanja',
      'Pojedinosti',
      'Nije poznato',
      'Upiši to pod Promijeni',
      'Profil tvrtke iz izvora Finnhub',
      'Burza',
      ...SAMPLE_SPIN_CO_PAGE.croatian,
    ],
    cards: false,
  },
  {
    name: 'investments-holding-fund',
    query: 'investments=sample',
    hash: `#/investments/holding?instrument=${SAMPLE_WORLD_ETF}`,
    title: 'Example World ETF',
    charts: 1,
    ready: '[data-mix="country"] .donut-ring canvas',
    shows: [
      'Details',
      'Fund or ETF',
      'Its mix, as you typed it',
      '11 sectors',
      '8 countries or regions',
      'TER',
      '0.20%',
      'Dividends',
      'Accumulating',
      'Alpha Vantage',
      'As XYZ.DEX there',
      'By sector',
      'By country or region',
      'of this holding',
      'United States',
      'Domicile',
      'Ireland',
      'From its ISIN',
      '52-week range',
      'Alpha Vantage sent no fund profile for XYZ.DEX',
      'in its daily fetch. There is no Alpha Vantage key in this browser.',
      'Prices settings',
      ...fakeDetailsShows(SAMPLE_WORLD_ETF),
    ],
    cards: false,
  },
  {
    name: 'investments-holding-fund-croatian',
    query: 'investments=sample&lang=hr',
    hash: `#/investments/holding?instrument=${SAMPLE_WORLD_ETF}`,
    title: 'Example World ETF',
    charts: 1,
    ready: '[data-mix="country"] .donut-ring canvas',
    shows: [
      'Pojedinosti',
      'Fond ili ETF',
      'Raspodjela koju ste upisali',
      '11 sektora',
      '8 država ili regija',
      'Dividende',
      'Akumulirajući',
      'Po sektoru',
      'Po državi ili regiji',
      'ove pozicije',
      'Sjedište fonda',
      'Irska',
      'Raspon u 52 tjedna',
      'Alpha Vantage nije poslao profil fonda za XYZ.DEX',
      'pri dnevnom dohvaćanju. U ovom pregledniku nema ključa za Alpha Vantage.',
      'Postavke cijena',
    ],
    cards: false,
  },
  {
    name: 'investments-holding-fund-profile',
    query: 'investments=sample',
    hash: `#/investments/holding?instrument=${SAMPLE_MONEY_FUND}`,
    title: 'Example Money Fund',
    charts: 1,
    ready: '[data-testid="holding-details"]',
    shows: [
      'Details',
      'TER',
      '0.15%',
      'Fund profile from Alpha Vantage',
      'Fund size',
      'From Alpha Vantage, no currency stated',
      'Started',
      '48 holdings',
      'Listed by Alpha Vantage, maybe not all',
      ...fakeDetailsShows(SAMPLE_MONEY_FUND),
    ],
    cards: false,
  },
  {
    name: 'investments-holding-fund-profile-croatian',
    query: 'investments=sample&lang=hr',
    hash: `#/investments/holding?instrument=${SAMPLE_MONEY_FUND}`,
    title: 'Example Money Fund',
    charts: 1,
    ready: '[data-testid="holding-details"]',
    shows: [
      'Pojedinosti',
      'TER',
      'Profil fonda iz izvora Alpha Vantage',
      'Veličina fonda',
      'Iz izvora Alpha Vantage, bez valute',
      'Osnovan',
      '48 pozicija',
      'Popis iz izvora Alpha Vantage, možda nepotpun',
    ],
    cards: false,
  },
  {
    name: 'investments-holding-refused-profile',
    query: 'investments=sample',
    hash: `#/investments/holding?instrument=${SAMPLE_SHARE_B}`,
    title: 'Example Dividend Co',
    charts: 1,
    ready: '[data-testid="holding-fact-problem"]',
    shows: [
      'Details',
      'Finnhub refused the company profile for US000000DEF2: it needs a paid key',
      'There is no Finnhub key in this browser.',
      'Prices settings',
      'From its ISIN',
      ...fakeDetailsShows(SAMPLE_SHARE_B),
    ],
    cards: false,
  },
  {
    name: 'investments-holding-refused-profile-croatian',
    query: 'investments=sample&lang=hr',
    hash: `#/investments/holding?instrument=${SAMPLE_SHARE_B}`,
    title: 'Example Dividend Co',
    charts: 1,
    ready: '[data-testid="holding-fact-problem"]',
    shows: ['Pojedinosti', 'Finnhub odbio je profil tvrtke za US000000DEF2: traži plaćeni ključ', 'U ovom pregledniku nema ključa za Finnhub.', 'Postavke cijena', 'Iz ISIN-a'],
    cards: false,
  },
  {
    name: 'investments-holding-no-mix',
    query: 'investments=sample',
    hash: `#/investments/holding?instrument=${SAMPLE_INDEX_FUND}`,
    title: 'Example Index Fund',
    charts: 1,
    ready: '[data-testid="holding-no-mix"]',
    shows: ['Details', 'No mix by sector or country yet', 'Type its mix', 'Not known'],
    cards: false,
  },
  {
    name: 'investments-holding-compare',
    query: 'investments=sample',
    hash: `#/investments/holding?instrument=${SAMPLE_SHARE_A}&compare=twelvedata:EXQ`,
    title: SAMPLE_SHARE_A_PAGE.name,
    charts: 1,
    ready: '[data-testid="compare-chip"]',
    shows: ['Change since', 'each line as quoted', 'EXQ', 'Buy'],
    cards: false,
  },
  {
    name: 'investments-holding-compare-croatian',
    query: 'investments=sample&lang=hr',
    hash: `#/investments/holding?instrument=${SAMPLE_SHARE_A}&compare=twelvedata:EXQ`,
    title: SAMPLE_SHARE_A_PAGE.name,
    charts: 1,
    ready: '[data-testid="compare-chip"]',
    shows: ['Promjena od', 'svaka linija kako kotira', 'EXQ', 'Kupnja'],
    cards: false,
  },
  {
    name: 'investments-holding-young',
    query: 'investments=young',
    hash: `#/investments/holding?instrument=${SAMPLE_WORLD_ETF}`,
    title: 'Example World ETF',
    charts: 1,
    shows: ['Price', 'First buy', '1Y', 'Custom', 'All'],
    cards: false,
  },
  {
    name: 'investments-holding-young-croatian',
    query: 'investments=young&lang=hr',
    hash: `#/investments/holding?instrument=${SAMPLE_WORLD_ETF}`,
    title: 'Example World ETF',
    charts: 1,
    shows: ['Cijena', 'Prva kupnja', '1G', 'Prilagođeno', 'Sve'],
    cards: false,
  },
  {
    name: 'investments-transactions',
    query: 'investments=sample',
    hash: '#/investments/transactions',
    title: 'Transactions',
    charts: 0,
    ready: '[data-testid="transactions"] [data-testid="transaction-row"]',
    shows: ['records, newest first', 'Add transaction', 'All kinds', 'Fee refund', 'Exchange', 'EUR into USD', 'Spin-off', 'Example Spinco from Example Dividend Co', '2 for 1', 'Monthly statement'],
    cards: false,
  },
  {
    name: 'investments-transactions-croatian',
    query: 'investments=sample&lang=hr',
    hash: '#/investments/transactions',
    title: 'Transakcije',
    charts: 0,
    ready: '[data-testid="transactions"] [data-testid="transaction-row"]',
    shows: ['zapisa, najnoviji prvi', 'Dodaj transakciju', 'Sve vrste', 'Povrat naknade', 'Konverzija', 'EUR u USD', 'Izdvajanje', '2 za 1'],
    cards: false,
  },
  {
    name: 'investments-transactions-empty',
    query: 'investments=drive',
    hash: '#/investments/transactions',
    title: 'Transactions',
    charts: 0,
    ready: '[data-testid="transactions-empty"]',
    shows: ['Every buy, sale, dividend, deposit, exchange and transfer shows here once you add it.', 'Add transaction'],
    cards: false,
  },
  {
    name: 'investments-performance',
    query: 'investments=sample',
    hash: '#/investments/performance',
    title: 'Performance',
    charts: 1,
    ready: '[data-testid="performance-tiles"]',
    shows: [
      'Your return',
      'Yearly return',
      'Benchmark',
      'Example Index Fund',
      'Difference',
      'Growth of €100.00',
      'The same money in Example Index Fund',
      'Returns by year',
      'so far',
      'A year with fewer than 12 monthly returns has no volatility.',
      ...SAMPLE_PERFORMANCE.english,
    ],
  },
  {
    name: 'investments-performance-croatian',
    query: 'investments=sample&lang=hr',
    hash: '#/investments/performance',
    title: 'Uspješnost',
    charts: 1,
    ready: '[data-testid="performance-tiles"]',
    shows: [
      'Vaš prinos',
      'Godišnji prinos',
      'Indeks',
      'Razlika',
      'Rast od 100,00',
      'Isti novac u indeksu Example Index Fund',
      'Prinosi po godinama',
      'zasad',
      'Godina s manje od 12 mjesečnih prinosa nema volatilnost.',
      ...SAMPLE_PERFORMANCE.croatian,
    ],
  },
  {
    name: 'investments-performance-compare',
    query: 'investments=sample',
    hash: '#/investments/performance?compare=twelvedata:EXQ',
    title: 'Performance',
    charts: 1,
    ready: '[data-testid="compare-chip"]',
    shows: ['Change since', "EXQ in euros at the day's ECB rate", 'Your portfolio', 'The same money in Example Index Fund'],
  },
  {
    name: 'investments-performance-compare-croatian',
    query: 'investments=sample&lang=hr',
    hash: '#/investments/performance?compare=twelvedata:EXQ',
    title: 'Uspješnost',
    charts: 1,
    ready: '[data-testid="compare-chip"]',
    shows: ['Promjena od', 'EXQ u eurima po ECB-ovu tečaju dana', 'Vaš portfelj'],
  },
  {
    name: 'investments-performance-compare-index',
    query: 'investments=sample',
    hash: '#/investments/performance?compare=twelvedata:SPY',
    title: 'Performance',
    charts: 1,
    ready: '[data-testid="compare-chip"]',
    shows: ['Change since', "S&P 500 (SPY) in euros at the day's ECB rate", 'S&P 500 (SPY)', 'Your portfolio'],
  },
  {
    name: 'investments-performance-quarter',
    query: 'investments=sample',
    hash: '#/investments/performance?period=2024q2',
    title: 'Performance',
    charts: 1,
    ready: '[data-testid="performance-part"]',
    shows: ['From 31 Mar 2024 to 30 Jun 2024.', 'Q2', 'Growth of €100.00', 'Under a year', 'Returns by year'],
  },
  {
    name: 'investments-performance-year-croatian',
    query: 'investments=sample&lang=hr',
    hash: '#/investments/performance?period=2024',
    title: 'Uspješnost',
    charts: 1,
    ready: '[data-testid="performance-part"]',
    shows: ['Cijela godina', 'Rast od 100,00', 'Prinosi po godinama', ...YEAR_PERFORMANCE.croatian],
  },
  {
    name: 'investments-performance-year',
    query: 'investments=sample',
    hash: '#/investments/performance?period=2024',
    title: 'Performance',
    charts: 1,
    ready: '[data-testid="performance-part"]',
    shows: ['Whole year', ...YEAR_PERFORMANCE.english],
  },
  {
    name: 'investments-performance-months',
    query: 'investments=sample',
    hash: '#/investments/performance?tab=months',
    title: 'Performance',
    charts: 0,
    ready: '[data-testid="performance-months"]',
    shows: ['Returns by month', 'Every month since your first deposit, time-weighted', 'Your return', 'Against the index', 'Year', SAMPLE_PERFORMANCE_TABS.months],
  },
  {
    name: 'investments-performance-months-croatian',
    query: 'investments=sample&lang=hr',
    hash: '#/investments/performance?tab=months',
    title: 'Uspješnost',
    charts: 0,
    ready: '[data-testid="performance-months"]',
    shows: ['Prinosi po mjesecima', 'Vaš prinos', 'Prema indeksu', 'Godina'],
  },
  {
    name: 'investments-performance-sources',
    query: 'investments=sample',
    hash: '#/investments/performance?tab=sources',
    title: 'Performance',
    charts: 2,
    ready: '[data-testid="performance-currency"]',
    shows: ['How the value changed', 'Start', 'End', 'What drove the return', 'Currency effect', 'Put in or taken out', 'Gain', 'Trading fees of', 'Portfolio', ...SAMPLE_PERFORMANCE_TABS.sources],
    cards: false,
  },
  {
    name: 'investments-performance-sources-1y',
    query: 'investments=sample',
    hash: '#/investments/performance?tab=sources&period=1y',
    title: 'Performance',
    charts: 2,
    ready: '[data-testid="performance-currency"]',
    shows: ['How the value changed', 'What drove the return', 'Currency effect', ...SAMPLE_PERFORMANCE_TABS.sourcesLastYear],
    cards: false,
  },
  {
    name: 'investments-performance-sources-croatian',
    query: 'investments=sample&lang=hr',
    hash: '#/investments/performance?tab=sources',
    title: 'Uspješnost',
    charts: 2,
    ready: '[data-testid="performance-currency"]',
    shows: ['Kako se mijenjala vrijednost', 'Početak', 'Kraj', 'Što je donijelo prinos', 'Učinak tečaja', 'Uloženo ili isplaćeno', 'Portfelj', ...SAMPLE_PERFORMANCE_TABS.sourcesCroatian],
    cards: false,
  },
  {
    name: 'investments-performance-falls',
    query: 'investments=sample',
    hash: '#/investments/performance?tab=falls',
    title: 'Performance',
    charts: 1,
    ready: '[data-testid="performance-underwater"]',
    shows: ['Below the peak', 'Now', 'Deepest', 'Longest below a peak', 'Largest fall and volatility', SAMPLE_PERFORMANCE_TABS.deepest],
    cards: false,
  },
  {
    name: 'investments-performance-falls-croatian',
    query: 'investments=sample&lang=hr',
    hash: '#/investments/performance?tab=falls',
    title: 'Uspješnost',
    charts: 1,
    ready: '[data-testid="performance-underwater"]',
    shows: ['Ispod vrha', 'Sada', 'Najdublje', 'Najdulje ispod vrha', 'Najveći pad i volatilnost'],
    cards: false,
  },
  {
    name: 'investments-performance-young',
    query: 'investments=young',
    hash: '#/investments/performance',
    title: 'Performance',
    charts: 1,
    ready: '[data-testid="performance-tiles"]',
    shows: ['Under a year', 'Shown for a period of a year or more', 'time-weighted', 'None chosen', 'Pick one in Settings', ...YOUNG_PERFORMANCE.english],
  },
  {
    name: 'investments-performance-young-croatian',
    query: 'investments=young&lang=hr',
    hash: '#/investments/performance',
    title: 'Uspješnost',
    charts: 1,
    ready: '[data-testid="performance-tiles"]',
    shows: ['Manje od godine', 'vremenski ponderirano', 'Nije odabran', 'Odaberi ga u postavkama', ...YOUNG_PERFORMANCE.croatian],
  },
  {
    name: 'investments-performance-no-benchmark',
    query: 'investments=sample&prices=no-benchmark',
    hash: '#/investments/performance',
    title: 'Performance',
    charts: 1,
    ready: '[data-testid="performance-notice"]',
    shows: ['Example Index Fund has no close in the prices file yet', 'No closes yet', 'Nothing to compare with', ...NO_BENCHMARK_PERFORMANCE.english],
  },
  {
    name: 'investments-performance-no-benchmark-croatian',
    query: 'investments=sample&prices=no-benchmark&lang=hr',
    hash: '#/investments/performance',
    title: 'Uspješnost',
    charts: 1,
    ready: '[data-testid="performance-notice"]',
    shows: ['Example Index Fund: u datoteci cijena još nema zaključne cijene', 'Još nema cijena', 'Nema usporedbe', ...NO_BENCHMARK_PERFORMANCE.croatian],
  },
  {
    name: 'investments-performance-income',
    query: 'investments=sample',
    hash: '#/investments/performance?tab=income',
    title: 'Performance',
    charts: 1,
    ready: '[data-testid="income-by-year"]',
    shows: ['Dividends, interest and other income, with the tax withheld at source.', 'By month', 'By year', 'Dividends', 'Interest', 'so far', ...SAMPLE_INCOME.income],
  },
  {
    name: 'investments-performance-income-croatian',
    query: 'investments=sample&lang=hr',
    hash: '#/investments/performance?tab=income',
    title: 'Uspješnost',
    charts: 1,
    ready: '[data-testid="income-by-year"]',
    shows: ['Po mjesecima', 'Po godinama', 'Dividende', 'Kamate', 'zasad', ...SAMPLE_INCOME.incomeCroatian],
  },
  {
    name: 'investments-performance-coming',
    query: 'investments=sample',
    hash: '#/investments/performance?tab=coming',
    title: 'Performance',
    charts: 1,
    ready: '[data-testid="coming-list"]',
    shows: ['Coming income', 'Announced', 'From last year', 'Payments to come', 'Status', 'Example Dividend Co', ...SAMPLE_INCOME.coming],
  },
  {
    name: 'investments-performance-coming-croatian',
    query: 'investments=sample&lang=hr',
    hash: '#/investments/performance?tab=coming',
    title: 'Uspješnost',
    charts: 1,
    ready: '[data-testid="coming-list"]',
    shows: ['Očekivani prihod', 'Najavljeno', 'Prema prošloj godini', 'Isplate koje dolaze', ...SAMPLE_INCOME.comingCroatian],
  },
  {
    name: 'investments-tax-partial-history',
    query: 'investments=partial-history',
    hash: '#/investments/tax',
    title: 'Tax',
    charts: 0,
    ready: '[data-testid="tax-history"]',
    shows: ['Tax on sales is left out for now', 'My history is complete'],
    cards: false,
  },
  {
    name: 'investments-tax-partial-history-croatian',
    query: 'investments=partial-history&lang=hr',
    hash: '#/investments/tax',
    title: 'Porez',
    charts: 0,
    ready: '[data-testid="tax-history"]',
    shows: ['Porez na prodaje zasad je izostavljen', 'Povijest je potpuna'],
    cards: false,
  },
  {
    name: 'investments-overview-partial-history',
    query: 'investments=partial-history',
    hash: '#/investments',
    title: 'Overview',
    charts: 1,
    ready: '[data-testid="getting-set-up"]',
    shows: ['Getting set up', 'Tell Kuna when this is your whole history'],
  },
  {
    name: 'investments-tax',
    query: 'investments=sample',
    hash: '#/investments/tax?year=2026',
    title: 'Tax',
    charts: 0,
    ready: '[data-testid="tax-deadlines"]',
    shows: ['Tax to pay', 'What to type into JOPPD', 'Deadlines', 'Rules Kuna uses', ...SAMPLE_TAX.year],
  },
  {
    name: 'investments-tax-croatian',
    query: 'investments=sample&lang=hr',
    hash: '#/investments/tax?year=2026',
    title: 'Porez',
    charts: 0,
    ready: '[data-testid="tax-deadlines"]',
    shows: ['Porez za uplatu', 'Što upisati u JOPPD', 'Rokovi', 'Pravila koja Kuna koristi', ...SAMPLE_TAX.yearCroatian],
  },
  {
    name: 'investments-tax-2023-city',
    query: 'investments=sale-2023',
    hash: '#/investments/tax?year=2023',
    title: 'Tax',
    charts: 0,
    ready: '[data-testid="tax-deadlines"]',
    shows: ['Your city in 2023', 'City not chosen', 'Choose it under Your city in 2023'],
  },
  {
    name: 'investments-tax-2023-city-croatian',
    query: 'investments=sale-2023&lang=hr',
    hash: '#/investments/tax?year=2023',
    title: 'Porez',
    charts: 0,
    ready: '[data-testid="tax-deadlines"]',
    shows: ['Vaš grad u 2023.', 'Grad nije odabran', 'Odaberi ga pod Vaš grad u 2023.'],
  },
  {
    name: 'investments-tax-sales',
    query: 'investments=sample',
    hash: '#/investments/tax?year=2026&tab=sales',
    title: 'Tax',
    charts: 0,
    ready: '[data-testid="tax-sales"]',
    shows: ['Example Tech', 'Example Spinco', 'Tax-free', 'Old loss, not offset', 'Download for Porezna (XLSX)', 'settles 5 Oct 2026, estimated', 'settles 20 Oct 2026', ...SAMPLE_TAX.sales],
    lacks: ['settles 20 Oct 2026, estimated'],
  },
  {
    name: 'investments-tax-sales-croatian',
    query: 'investments=sample&lang=hr',
    hash: '#/investments/tax?year=2026&tab=sales',
    title: 'Porez',
    charts: 0,
    ready: '[data-testid="tax-sales"]',
    shows: ['Bez poreza', 'Stari gubitak, ne odbija se', 'Preuzmi za Poreznu (XLSX)', 'namira 5.\u00a010.\u00a02026., procjena', 'namira 20.\u00a010.\u00a02026.', ...SAMPLE_TAX.salesCroatian],
    lacks: ['namira 20.\u00a010.\u00a02026., procjena'],
  },
  {
    name: 'investments-tax-foreign',
    query: 'investments=sample',
    hash: '#/investments/tax?year=2026&tab=foreign',
    title: 'Tax',
    charts: 0,
    ready: '[data-testid="tax-foreign"]',
    shows: [
      'Foreign income',
      'United States',
      'Ireland',
      'Country not known',
      'No US treaty in force in 2026, 30% withheld',
      "Owes 10% pension contributions and tax at your city's lower rate on the rest. Unconfirmed.",
      ...SAMPLE_TAX.foreign,
    ],
  },
  {
    name: 'investments-tax-foreign-croatian',
    query: 'investments=sample&lang=hr',
    hash: '#/investments/tax?year=2026&tab=foreign',
    title: 'Porez',
    charts: 0,
    ready: '[data-testid="tax-foreign"]',
    shows: [
      'Inozemni dohodak',
      'Sjedinjene Američke Države',
      'Irska',
      'Država nije poznata',
      'Duguje 10 % doprinosa za mirovinsko i porez po nižoj stopi vašeg grada na ostatak. Nepotvrđeno.',
      ...SAMPLE_TAX.foreignCroatian,
    ],
  },
  {
    name: 'investments-tax-tax-free',
    query: 'investments=sample',
    hash: '#/investments/tax?tab=tax-free',
    title: 'Tax',
    charts: 0,
    ready: '[data-testid="tax-free-lots"]',
    shows: ['Turns tax-free', 'Value now', ...SAMPLE_INCOME.taxFree],
  },
  {
    name: 'investments-tax-tax-free-croatian',
    query: 'investments=sample&lang=hr',
    hash: '#/investments/tax?tab=tax-free',
    title: 'Porez',
    charts: 0,
    ready: '[data-testid="tax-free-lots"]',
    shows: ['Postaje bez poreza', 'Vrijednost sada', 'bez poreza od', ...SAMPLE_INCOME.taxFreeCroatian],
  },
  {
    name: 'investments-performance-costs',
    query: 'investments=sample',
    hash: '#/investments/performance?tab=costs',
    title: 'Performance',
    charts: 0,
    ready: '[data-testid="costs-years"]',
    shows: [
      'Costs per year',
      'Trading fees',
      'Exchange fees',
      'Account fees',
      'Fund costs, estimated',
      'Example World ETF',
      'TER 0.20%',
      'so far',
      "Fund costs are already inside each fund's price",
      ...SAMPLE_INCOME.costs,
    ],
  },
  {
    name: 'investments-performance-costs-croatian',
    query: 'investments=sample&lang=hr',
    hash: '#/investments/performance?tab=costs',
    title: 'Uspješnost',
    charts: 0,
    ready: '[data-testid="costs-years"]',
    shows: ['Troškovi po godinama', 'Naknade trgovanja', 'Naknade konverzije', 'Naknade računa', 'Troškovi fondova, procjena', 'zasad', ...SAMPLE_INCOME.costsCroatian],
  },
  {
    name: 'investments-performance-saving',
    query: 'investments=sample',
    hash: '#/investments/performance?tab=saving',
    title: 'Performance',
    charts: 2,
    ready: '[data-testid="projection-chart"]',
    shows: [
      'Months in a row',
      'Longest run',
      'A month, last 12 months',
      'How regularly you invest',
      'Projection',
      'Each month',
      'Return a year',
      'At 3.5% a year you could take out',
      'At 4% a year you could take out',
      'Before tax and inflation',
      ...SAMPLE_INCOME.saving,
    ],
    cards: false,
  },
  {
    name: 'investments-performance-saving-croatian',
    query: 'investments=sample&lang=hr',
    hash: '#/investments/performance?tab=saving',
    title: 'Uspješnost',
    charts: 2,
    ready: '[data-testid="projection-chart"]',
    shows: [
      'Mjeseci zaredom',
      'Najdulji niz',
      'Mjesečno, zadnjih 12 mjeseci',
      'Koliko redovito ulažete',
      'Projekcija',
      'Svaki mjesec',
      'Prinos godišnje',
      'Prije poreza i inflacije',
      ...SAMPLE_INCOME.savingCroatian,
    ],
    cards: false,
  },
  {
    name: 'investments-prices-late',
    query: 'investments=sample&prices=late-prices',
    hash: '#/investments',
    title: 'Overview',
    charts: 1,
    ready: '[data-testid="investments-prices-behind"]',
    shows: [
      'Prices are behind',
      'The newest close is from',
      'The last fetch got nothing for 7 series',
      'Prices in Settings',
      `At the close of ${LATE_INVESTMENTS.close}.`,
      'Example Tech (ABC) is valued at its close of',
      ', which is late.',
      ...LATE_INVESTMENTS.english,
    ],
  },
  {
    name: 'investments-prices-late-croatian',
    query: 'investments=sample&prices=late-prices&lang=hr',
    hash: '#/investments',
    title: 'Pregled',
    charts: 1,
    ready: '[data-testid="investments-prices-behind"]',
    shows: ['Cijene kasne', 'Najnovija zaključna cijena je od', 'Zadnje dohvaćanje nije dobilo ništa za 7 nizova', 'Cijene u postavkama', 'koja kasni.', ...LATE_INVESTMENTS.croatian],
  },
  {
    name: 'investments-prices-settings',
    query: 'investments=sample',
    hash: '#/investments/settings?tab=prices',
    title: 'Settings',
    charts: 0,
    ready: '[data-testid="investments-prices-card"] [data-vendor="ecb"]',
    shows: [
      'Where prices come from',
      'Twelve Data',
      'Finnhub',
      'Company profiles of US shares',
      'Alpha Vantage',
      'European Central Bank',
      'No key in this browser.',
      'Needs no key.',
      'Get a free key',
      'Fetched',
      'Asked for 7 series, 0 already up to date.',
      'A free key takes 8 requests a minute and 800 a day.',
      'A free key takes 60 requests a minute.',
      'Gives daily closes and symbol search.',
      'Gives company profiles and symbol search.',
      'Gives daily closes, splits, fund profiles, announced dividends and symbol search.',
      'Import closes',
    ],
    cards: false,
  },
  {
    name: 'investments-prices-settings-croatian',
    query: 'investments=sample&lang=hr',
    hash: '#/investments/settings?tab=prices',
    title: 'Postavke',
    charts: 0,
    ready: '[data-testid="investments-prices-card"] [data-vendor="ecb"]',
    shows: [
      'Odakle dolaze cijene',
      'Profili američkih dionica',
      'Daje profile tvrtki i pretragu simbola.',
      'Europska središnja banka',
      'U ovom pregledniku nema ključa.',
      'Ne treba ključ.',
      'Besplatan ključ',
      'Zadnje dohvaćanje',
      'Besplatni ključ prima 8 zahtjeva u minuti i 800 dnevno.',
      'Uvoz zaključnih cijena',
    ],
    cards: false,
  },
  {
    name: 'investments-settings-sample',
    query: 'investments=sample',
    hash: '#/investments/settings',
    title: 'Settings',
    charts: 0,
    ready: '[data-testid="investments-books-card"]',
    shows: ['General', 'Prices', 'What Performance compares your portfolio with', 'Its last close in the prices file is from', 'Add a benchmark'],
  },
  {
    name: 'investments-settings-checks',
    query: 'investments=sample',
    hash: '#/investments/settings?tab=checks',
    title: 'Settings',
    charts: 0,
    ready: '[data-testid="investments-checks"]',
    shows: ['Checks', 'Portfolio checks', 'Largest holding', 'Default threshold 20%', 'Costs of the last 12 months', 'Gap to the target mix', 'Default threshold 5 points'],
    cards: false,
  },
  {
    name: 'investments-settings-checks-croatian',
    query: 'investments=sample&lang=hr',
    hash: '#/investments/settings?tab=checks',
    title: 'Postavke',
    charts: 0,
    ready: '[data-testid="investments-checks"]',
    shows: ['Provjere', 'Provjere portfelja', 'Najveća pozicija', 'Zadani prag 20\u00a0%', 'Troškovi u zadnjih 12 mjeseci', 'Zadani prag 5 postotnih bodova', 'Uključeno'],
    cards: false,
  },
  {
    name: 'investments-settings-binned',
    query: 'investments=binned',
    hash: '#/investments/settings',
    title: 'Settings',
    charts: 0,
    ready: '[data-testid="books-file-missing"]',
    shows: ['Kuna stopped using this file', 'The file is in the Drive bin, so Kuna no longer reads or saves it.', 'Switch storage'],
  },
  {
    name: 'investments-settings-binned-croatian',
    query: 'investments=binned&lang=hr',
    hash: '#/investments/settings',
    title: 'Postavke',
    charts: 0,
    ready: '[data-testid="books-file-missing"]',
    shows: ['Kuna je prestala koristiti ovu datoteku', 'Datoteka je u otpadu na Driveu, pa je Kuna više ne čita i ne sprema.', 'Promijeni mjesto'],
  },
  {
    name: 'investments-settings-sample-croatian',
    query: 'investments=sample&lang=hr',
    hash: '#/investments/settings',
    title: 'Postavke',
    charts: 0,
    ready: '[data-testid="investments-books-card"]',
    shows: ['Općenito', 'Cijene', 'Referentni indeks', 'Dodaj indeks'],
  },
  {
    name: 'investments-prices-settings-keys',
    query: 'investments=sample',
    hash: '#/investments/settings?tab=prices',
    title: 'Settings',
    charts: 0,
    ready: '[data-testid="investments-prices-card"] [data-testid="price-vendor-forget"]',
    stored: { 'kuna.secret.twelvedata': 'made-up-twelve-data-key-0042', 'kuna.secret.alphavantage': 'MADEUPKEY01' },
    shows: ['A key ending in 0042 is kept in this browser.', 'A key is kept in this browser.', 'Remove'],
    cards: false,
  },
  {
    name: 'investments-prices-settings-keys-croatian',
    query: 'investments=sample&lang=hr',
    hash: '#/investments/settings?tab=prices',
    title: 'Postavke',
    charts: 0,
    ready: '[data-testid="investments-prices-card"] [data-testid="price-vendor-forget"]',
    stored: { 'kuna.secret.twelvedata': 'made-up-twelve-data-key-0042', 'kuna.secret.alphavantage': 'MADEUPKEY01' },
    shows: ['U ovom pregledniku čuva se ključ koji završava na 0042.', 'U ovom pregledniku čuva se ključ.', 'Ukloni'],
    cards: false,
  },
  {
    name: 'investments-prices-settings-synced',
    query: 'investments=sample&keys=other-browser',
    hash: '#/investments/settings?tab=prices',
    title: 'Settings',
    charts: 0,
    ready: '[data-testid="investments-prices-card"] [data-vendor="twelvedata"][data-kept="true"]',
    shows: ['A key ending in 8642 is kept in this browser.', 'Each sync saves them to your Google account, hidden from Drive, so every browser you sign in to gets them.'],
    cards: false,
  },
  {
    name: 'investments-prices-settings-synced-croatian',
    query: 'investments=sample&keys=other-browser&lang=hr',
    hash: '#/investments/settings?tab=prices',
    title: 'Postavke',
    charts: 0,
    ready: '[data-testid="investments-prices-card"] [data-vendor="twelvedata"][data-kept="true"]',
    shows: ['U ovom pregledniku čuva se ključ koji završava na 8642.', 'Svaka ih sinkronizacija sprema na vaš Google račun, u skrivenu mapu koju Drive ne prikazuje'],
    cards: false,
  },
  {
    name: 'investments-prices-settings-removed',
    query: 'investments=sample&keys=removed',
    hash: '#/investments/settings?tab=prices',
    title: 'Settings',
    charts: 0,
    ready: '[data-testid="investments-prices-card"] [data-vendor="twelvedata"][data-kept="false"]',
    stored: { 'kuna.secret.twelvedata': 'made-up-twelve-data-key-0042', 'kuna.secret-changed.twelvedata': FAKE_KEY_SAVED_AT },
    shows: ['No key in this browser.', 'Each sync saves them to your Google account, hidden from Drive'],
    cards: false,
  },
  {
    name: 'investments-prices-legacy-keys',
    query: 'investments=sample&keys=legacy',
    hash: '#/investments/settings?tab=prices',
    title: 'Settings',
    charts: 0,
    ready: '[data-testid="investments-prices-card"] [data-vendor="twelvedata"][data-kept="true"]',
    shows: ['A key ending in 5307 is kept in this browser.', 'Each sync saves them to your Google account, hidden from Drive'],
    cards: false,
  },
  {
    name: 'investments-prices-settings-late',
    query: 'investments=sample&prices=late-prices',
    hash: '#/investments/settings?tab=prices',
    title: 'Settings',
    charts: 0,
    ready: '[data-testid="prices-failures"]',
    shows: [
      'The last fetch got nothing for 7 series',
      'Example Tech (ABC)',
      'Twelve Data refused the request.',
      "Alpha Vantage's limit was reached.",
      'USD rates',
      'European Central Bank did not answer.',
    ],
    cards: false,
  },
  {
    name: 'investments-prices-settings-late-croatian',
    query: 'investments=sample&prices=late-prices&lang=hr',
    hash: '#/investments/settings?tab=prices',
    title: 'Postavke',
    charts: 0,
    ready: '[data-testid="prices-failures"]',
    shows: [
      'Zadnje dohvaćanje nije dobilo ništa za 7 nizova',
      'Twelve Data: zahtjev je odbijen.',
      'Alpha Vantage: dosegnuto je ograničenje.',
      'Tečajevi USD',
      'Europska središnja banka: nema odgovora.',
    ],
    cards: false,
  },
]
