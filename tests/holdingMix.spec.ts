import { describe, expect, it } from 'vitest'

import { exposureOf } from '../src/apps/investments/holdings/domain/exposure'
import { holdingMix } from '../src/apps/investments/holdings/domain/holdingMix'
import { portfolioFigures } from '../src/apps/investments/holdings/domain/portfolioFigures'
import type { PortfolioFigures } from '../src/apps/investments/holdings/domain/portfolioFigures'
import type { FundMixLine } from '../src/apps/investments/workbook/domain/fundMix'
import type { Instrument } from '../src/apps/investments/workbook/domain/instrument'
import type { InvestmentBook } from '../src/apps/investments/workbook/domain/investmentBook'
import { FUND_MIX_RECORDS } from '../src/apps/investments/workbook/domain/investmentKinds'
import { countryOf } from '../src/apps/investments/workbook/domain/mixGroup'
import type { FundMixGroup } from '../src/apps/investments/workbook/domain/mixGroup'
import { EURO } from '../src/shared/money/currencyCode'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { BROKER, USD, WORKED_PRICES, WORKED_RATES, account, book, cashMovement, decimal, instrument, priceBookOf, rateBookOf, trade, unitTransfer, workedPortfolio } from './fixtures/investments'
import type { CloseRow } from './fixtures/investments'
import { civil, euros } from './fixtures/ledger'

const TODAY = civil('2026-10-29')

function mixLines(fund: Instrument, mix: FundMixGroup['mix'], percents: readonly (readonly [string, string])[]): FundMixLine[] {
  return percents.map(([group, percent]) => ({
    id: recordIdOf(FUND_MIX_RECORDS, `${fund.symbol}-${mix}-${group}`),
    instrument: fund.id,
    slice: { mix, group } as FundMixGroup,
    percent: decimal(percent),
  }))
}

function figuresOf(records: InvestmentBook, closes: ReadonlyMap<Instrument, readonly CloseRow[]>): PortfolioFigures {
  return portfolioFigures({ book: records, prices: priceBookOf(closes), rates: rateBookOf(new Map()), today: TODAY })
}

const SHARE = instrument('share', { name: 'Example Chips', sector: 'information-technology', isin: 'US0000000001' })
const FUND = instrument('fund', { name: 'Example Fund', isin: 'IE0000000002', ter: decimal('0.2') })
const FUND_SECTORS = mixLines(FUND, 'sector', [
  ['information-technology', '25'],
  ['financials', '15'],
  ['health-care', '10'],
  ['industrials', '50'],
])

/** €6,000.00 of a share and €4,000.00 of a fund, with €2,000.00 of cash left. */
function shareAndFund(overrides: { share?: Partial<Instrument>; fund?: Partial<Instrument>; lines?: readonly FundMixLine[] } = {}): { records: InvestmentBook; figures: PortfolioFigures } {
  const share = { ...SHARE, ...overrides.share }
  const fund = { ...FUND, ...overrides.fund }
  const records = book({
    accounts: [BROKER],
    instruments: [share, fund],
    cashMovements: [cashMovement('deposit', BROKER, '2026-01-05', '12000')],
    trades: [trade('buy', BROKER, share, '2026-01-05', '60', '100', '0'), trade('buy', BROKER, fund, '2026-01-05', '40', '100', '0')],
    fundMixes: overrides.lines ?? FUND_SECTORS,
  })
  const closes = new Map<Instrument, readonly CloseRow[]>([
    [share, [['2026-10-29', '100']]],
    [fund, [['2026-10-29', '100']]],
  ])
  return { records, figures: figuresOf(records, closes) }
}

describe('where a holding sits by sector and by country', () => {
  it('takes a fund mix as typed, ahead of the fund’s own field', () => {
    const records = book({ fundMixes: FUND_SECTORS })

    expect(exposureOf({ ...FUND, sector: 'financials' }, 'sector', records).map((line) => [line.group, line.percent])).toEqual([
      ['information-technology', decimal('25')],
      ['financials', decimal('15')],
      ['health-care', decimal('10')],
      ['industrials', decimal('50')],
    ])
  })

  it('takes the typed field when there is no fund mix', () => {
    expect(exposureOf(SHARE, 'sector', book({}))).toEqual([{ group: 'information-technology', percent: decimal('100') }])
    expect(exposureOf({ ...SHARE, country: countryOf('DE') }, 'country', book({}))).toEqual([{ group: 'DE', percent: decimal('100') }])
  })

  it('reads a share’s country from its ISIN, but never a fund’s, whose ISIN names where it is domiciled', () => {
    expect(exposureOf(SHARE, 'country', book({}))).toEqual([{ group: 'US', percent: decimal('100') }])
    expect(exposureOf(FUND, 'country', book({}))).toEqual([])
    expect(exposureOf({ ...FUND, ter: null }, 'country', book({ fundMixes: FUND_SECTORS }))).toEqual([])
    expect(exposureOf({ ...SHARE, class: 'bonds' }, 'country', book({}))).toEqual([])
    expect(exposureOf({ ...SHARE, isin: 'XX0000000001' }, 'country', book({}))).toEqual([])
  })

  it('leaves a stock with no sector, no TER and no fund mix not known, since it may be a fund domiciled in Ireland', () => {
    const untyped = { ...FUND, ter: null }
    const { records, figures } = shareAndFund({ fund: { ter: null }, lines: [] })

    expect(exposureOf(untyped, 'country', book({}))).toEqual([])
    expect(holdingMix(figures, records, 'country').missing.map((holding) => holding.instrument.name)).toEqual(['Example Fund'])
  })
})

describe('the mixes of the holdings', () => {
  it('splits €6,000.00 of a share in information technology and €4,000.00 of a weighted fund by sector', () => {
    const { records, figures } = shareAndFund()
    const mix = holdingMix(figures, records, 'sector')

    // 6,000.00 + 25% of 4,000.00 = 7,000.00, then 50%, 15% and 10% of 4,000.00.
    expect(mix.parts.map((part) => [part.group, part.value, part.share])).toEqual([
      ['information-technology', euros(7000), 0.7],
      ['industrials', euros(2000), 0.2],
      ['financials', euros(600), 0.06],
      ['health-care', euros(400), 0.04],
    ])
    expect(mix).toMatchObject({ whole: euros(10000), unknown: euros(0), missing: [] })
  })

  it('moves the share’s €6,000.00 with its typed sector', () => {
    const { records, figures } = shareAndFund({ share: { sector: 'financials' } })

    expect(holdingMix(figures, records, 'sector').parts.map((part) => [part.group, part.value])).toEqual([
      ['financials', euros(6600)],
      ['industrials', euros(2000)],
      ['information-technology', euros(1000)],
      ['health-care', euros(400)],
    ])
  })

  it('leaves the cash out of the country mix and names the holding no source places yet', () => {
    const { records, figures } = shareAndFund({ lines: [] })
    const mix = holdingMix(figures, records, 'country')

    expect(mix.parts.map((part) => [part.group, part.value, part.share])).toEqual([['US', euros(6000), 0.6]])
    expect(mix.unknown).toBe(euros(4000))
    expect(mix.whole).toBe(euros(10000))
    expect(mix.missing.map((holding) => holding.instrument.name)).toEqual(['Example Fund'])
  })

  it('puts the worked portfolio in stocks and cash, and in euros and dollars, of the whole value', () => {
    const figures = portfolioFigures({ book: workedPortfolio(), prices: WORKED_PRICES, rates: WORKED_RATES, today: TODAY })
    const byClass = holdingMix(figures, workedPortfolio(), 'class')

    // Stocks: 1,875.00 + 776.79 = 2,651.79 of 3,414.75. Cash: 446.00 + 316.96 = 762.96.
    expect(byClass.parts.map((part) => [part.group, part.value])).toEqual([
      ['stocks', euros(2651.79)],
      ['cash', euros(762.96)],
    ])
    expect(byClass.parts[0]!.share).toBeCloseTo(0.776569, 6)
    expect(byClass.whole).toBe(euros(3414.75))
    // Euros: 1,875.00 + 446.00 = 2,321.00. Dollars: 776.79 + 316.96 = 1,093.75.
    expect(holdingMix(figures, workedPortfolio(), 'currency').parts.map((part) => [part.group, part.value])).toEqual([
      [EURO, euros(2321)],
      [USD, euros(1093.75)],
    ])
  })

  it('splits a holding in three accounts by its units there, the last account taking the rest', () => {
    const first = account('first', 'First')
    const second = account('second', 'Second')
    const third = account('third', 'Third')
    const etf = instrument('etf', { name: 'Example ETF' })
    const records = book({
      accounts: [first, second, third],
      instruments: [etf],
      cashMovements: [cashMovement('deposit', first, '2026-01-05', '100')],
      trades: [trade('buy', first, etf, '2026-01-05', '3', '33.333333', '0')],
      transfers: [unitTransfer(first, second, '2026-02-02', etf, '1'), unitTransfer(first, third, '2026-03-02', etf, '1')],
    })
    const figures = figuresOf(records, new Map([[etf, [['2026-10-29', '33.333333']]]]))

    // 3 × 33.333333 is €100.00, a unit in each account: €33.33 twice, and the third account, the last to hold it, takes the cent left.
    expect(new Map(holdingMix(figures, records, 'account').parts.map((part) => [part.group, part.value]))).toEqual(
      new Map([
        [first.id, euros(33.33)],
        [second.id, euros(33.33)],
        [third.id, euros(33.34)],
      ]),
    )
  })
})
