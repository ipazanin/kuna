import { describe, expect, it } from 'vitest'

import { rulesOf } from '../src/apps/investments/tax/domain/taxRules'
import { taxWithSurtax } from '../src/apps/investments/tax/domain/citySurtax'
import { capitalGainsYear, taxYearsOf, yearsWithoutRules } from '../src/apps/investments/tax/domain/taxYear'
import type { CapitalGainsYear } from '../src/apps/investments/tax/domain/taxYear'
import type { InvestmentBook } from '../src/apps/investments/workbook/domain/investmentBook'
import { SETTING_RECORDS } from '../src/apps/investments/workbook/domain/investmentKinds'
import { SURTAX_CITY_2023_KEY } from '../src/apps/investments/workbook/domain/investmentSettings'
import { settingRow } from '../src/shared/storage/domain/settingRows'
import { decimalText } from '../src/shared/money/decimal'
import { BROKER, USD, account, book, decimal, instrument, rateBookOf, spinOff, trade, unitTransfer } from './fixtures/investments'
import { civil, euros } from './fixtures/ledger'
import { EXAMPLE_RATES, TECH, exampleYear } from './fixtures/taxExample'

function figuresOf(year: CapitalGainsYear): number[] {
  return [year.taxableGains, year.lossesOffset, year.base, year.tax, year.taxFreeGains, year.oldLosses].map((cents) => cents / 100)
}

function withTrades(records: InvestmentBook, trades: InvestmentBook['trades']): InvestmentBook {
  return { ...records, trades: [...records.trades, ...trades] }
}

describe("a year's capital gains", () => {
  it('gives the worked example its JOPPD figures', () => {
    const year = capitalGainsYear(exampleYear(), EXAMPLE_RATES, 2026)

    // Field 11 is 49.17 on the World ETF's young lot and 166.67 on Example Tech, 215.84. The June loss of 80.00 comes
    // off, 135.84, and 12% of it is 16.30. The 298.33 past two years is the code-02 line, the 2023 lot's 40.00 apart.
    expect(figuresOf(year)).toEqual([215.84, 80, 135.84, 16.3, 298.33, 40])
    expect([year.reportMark, year.due, year.estimated]).toEqual(['26365', '2027-03-01', false])
    // Field 16.2 is field 11 less the tax: 215.84 − 16.30 = 199.54.
    expect([year.payout, year.gainsLine, year.endsInLoss]).toEqual([euros(199.54), true, false])
    expect(year.sales.flatMap((sale) => sale.lines.map((line) => [sale.instrument.name, line.status, (line.gain ?? 0) / 100]))).toEqual([
      ['Example World ETF', 'tax-free', 298.33],
      ['Example World ETF', 'taxable', 49.17],
      ['Example Old Share', 'old-loss', -40],
      ['Example Dividend Co', 'loss', -80],
      ['Example Tech', 'taxable', 166.67],
    ])
  })

  it("converts the Monday-settling Example Tech sale once at Monday's own rate, whatever rate the record stores", () => {
    const sale = capitalGainsYear(exampleYear(), EXAMPLE_RATES, 2026).sales.find((candidate) => candidate.instrument.id === TECH.id)!

    // $200.00 of gain ÷ 1.2000, the list HNB publishes on Monday, is 166.67. Friday's 1.1900 would give 168.07, and the stored 1.08 would give 185.19.
    expect([sale.settles, sale.rate.kind === 'hnb' ? decimalText(sale.rate.rate.unitsPerEuro) : null, decimalText(sale.gainInCurrency), sale.gain]).toEqual(['2026-10-05', '1.2', '200', euros(166.67)])
    const storedElsewhere = exampleYear()
    const restated = { ...storedElsewhere, trades: storedElsewhere.trades.map((record) => (record.instrument === TECH.id ? { ...record, rate: decimal('1.5') } : record)) }
    expect(capitalGainsYear(restated, EXAMPLE_RATES, 2026).tax).toBe(euros(16.3))
  })

  it('floors the base at zero when the losses are larger than the gains', () => {
    const etf = instrument('etf')
    const records = book({
      instruments: [etf],
      trades: [trade('buy', BROKER, etf, '2026-01-05', '10', '100', '0'), trade('sell', BROKER, etf, '2026-02-02', '5', '110', '0'), trade('sell', BROKER, etf, '2026-03-02', '5', '60', '0')],
    })

    // 50.00 of gain and 200.00 of loss: 50.00 is offset, and the 150.00 left lowers nothing.
    const year = capitalGainsYear(records, EXAMPLE_RATES, 2026)
    expect(figuresOf(year)).toEqual([50, 50, 0, 0, 0, 0])
    expect([year.endsInLoss, year.gainsLine, year.due]).toEqual([true, false, null])
  })

  it('keeps the JOPPD of a year that ends in a loss for its tax-free gains only', () => {
    const etf = instrument('etf')
    const records = book({
      instruments: [etf],
      trades: [
        trade('buy', BROKER, etf, '2023-01-09', '5', '100', '0'),
        trade('buy', BROKER, etf, '2026-01-05', '5', '100', '0'),
        trade('sell', BROKER, etf, '2026-03-02', '5', '120', '0'),
        trade('sell', BROKER, etf, '2026-04-01', '5', '60', '0'),
      ],
    })

    // The 2023 lot is past two years, a 100.00 code-02 gain. The 2026 lot loses 200.00, so the year ends in a loss.
    const year = capitalGainsYear(records, EXAMPLE_RATES, 2026)
    expect([year.taxFreeGains, year.losses, year.endsInLoss, year.gainsLine, year.due]).toEqual([euros(100), euros(200), true, false, '2027-03-01'])
  })

  it('reports losses that equal the gains on a zero line, since the year does not end in a loss', () => {
    const etf = instrument('etf')
    const records = book({
      instruments: [etf],
      trades: [trade('buy', BROKER, etf, '2026-01-05', '10', '100', '0'), trade('sell', BROKER, etf, '2026-02-02', '5', '110', '0'), trade('sell', BROKER, etf, '2026-03-02', '5', '90', '0')],
    })

    const year = capitalGainsYear(records, EXAMPLE_RATES, 2026)
    expect([...figuresOf(year), year.endsInLoss, year.gainsLine, year.due]).toEqual([50, 50, 0, 0, 0, 0, false, true, '2027-03-01'])
  })

  it('leaves 2026 alone after a loss in 2025', () => {
    const etf = instrument('etf')
    const records = book({
      instruments: [etf],
      trades: [trade('buy', BROKER, etf, '2025-01-06', '10', '100', '0'), trade('sell', BROKER, etf, '2025-06-02', '5', '60', '0'), trade('sell', BROKER, etf, '2026-03-02', '5', '110', '0')],
    })

    expect(figuresOf(capitalGainsYear(records, EXAMPLE_RATES, 2025))).toEqual([0, 0, 0, 0, 0, 0])
    expect([capitalGainsYear(records, EXAMPLE_RATES, 2025).losses, capitalGainsYear(records, EXAMPLE_RATES, 2025).due]).toEqual([euros(200), null])
    expect(figuresOf(capitalGainsYear(records, EXAMPLE_RATES, 2026))).toEqual([50, 0, 50, 6, 0, 0])
  })

  it('taxes a sale on 13 Jan 2026 of a lot tax-free from 16 Jan, and warns it is near that day', () => {
    const etf = instrument('etf')
    const records = book({ instruments: [etf], trades: [trade('buy', BROKER, etf, '2024-01-15', '10', '100', '0'), trade('sell', BROKER, etf, '2026-01-13', '10', '110', '0')] })

    const [line] = capitalGainsYear(records, EXAMPLE_RATES, 2026).sales[0]!.lines
    expect([line!.status, line!.taxFreeFrom, line!.nearTaxFreeDay]).toEqual(['taxable', '2026-01-16', true])
  })

  it('warns a sale five days either side of the tax-free day, and not one six days away', () => {
    const etf = instrument('etf')
    const nearOn = (day: string): boolean => {
      const records = book({ instruments: [etf], trades: [trade('buy', BROKER, etf, '2024-01-15', '10', '100', '0'), trade('sell', BROKER, etf, day, '10', '110', '0')] })
      return capitalGainsYear(records, EXAMPLE_RATES, 2026).sales[0]!.lines[0]!.nearTaxFreeDay
    }

    expect(['2026-01-10', '2026-01-11', '2026-01-21', '2026-01-22'].map(nearOn)).toEqual([false, true, true, false])
  })

  it("keeps a spin-off lot on its parent's day, so selling it in 2026 is tax-free", () => {
    const parent = instrument('parent')
    const received = instrument('received')
    const records = book({
      instruments: [parent, received],
      trades: [trade('buy', BROKER, parent, '2023-03-01', '10', '100', '0'), trade('sell', BROKER, received, '2026-04-01', '2', '70', '0')],
      spinOffs: [spinOff(parent, received, '2025-11-17', '2', '0.1')],
    })

    // 10% of 1,000.00 moved with the 2 units, so 140.00 − 100.00 = 40.00, past two years from 1 Mar 2023.
    const [line] = capitalGainsYear(records, EXAMPLE_RATES, 2026).sales[0]!.lines
    expect([line!.realised.opened, line!.status, line!.gain]).toEqual(['2023-03-01', 'tax-free', euros(40)])
  })

  it('closes the 2024 lot of units bought at Broker One and sold at Broker Two, so the sale is tax-free', () => {
    const etf = instrument('etf')
    const two = account('two', 'Broker Two')
    const records = book({
      accounts: [BROKER, two],
      instruments: [etf],
      trades: [trade('buy', BROKER, etf, '2024-01-10', '10', '100', '0'), trade('buy', two, etf, '2026-03-02', '10', '120', '0'), trade('sell', two, etf, '2026-07-01', '10', '130', '0')],
      transfers: [unitTransfer(BROKER, two, '2025-05-05', etf, '10')],
    })

    const year = capitalGainsYear(records, EXAMPLE_RATES, 2026)
    expect(figuresOf(year)).toEqual([0, 0, 0, 0, 300, 0])
    // Tax-free gains alone still go on a JOPPD, with only the code-02 line.
    expect([year.gainsLine, year.endsInLoss, year.due]).toEqual([false, false, '2027-03-01'])
  })

  it('marks a sale whose settlement day has no rate yet as an estimate at the newest rate, and leaves a sale before the first rate out', () => {
    const share = instrument('share', { currency: USD })
    const rates = rateBookOf(
      new Map([
        [
          USD,
          [
            ['2026-10-01', '1.1990'],
            ['2026-10-02', '1.2000'],
          ],
        ],
      ]),
    )
    const records = book({
      instruments: [share],
      trades: [
        trade('buy', BROKER, share, '2026-01-05', '20', '100', '0', '1.1'),
        trade('sell', BROKER, share, '2026-03-02', '10', '110', '0', '1.1'),
        trade('sell', BROKER, share, '2026-10-05', '10', '112', '0', '1.1'),
      ],
    })

    const year = capitalGainsYear(records, rates, 2026)
    expect(year.sales.map((sale) => sale.rate)).toEqual([{ kind: 'missing' }, { kind: 'hnb', rate: { unitsPerEuro: decimal('1.2'), estimatedFrom: '2026-10-02' } }])
    // Only the October sale counts: $120.00 ÷ 1.2000 = 100.00.
    expect([year.estimated, year.taxableGains, year.leftOut]).toEqual([true, euros(100), 1])
  })

  it('counts a Xetra sale of 30 Dec 2026 settling in January in 2027, and flags it', () => {
    const etf = instrument('etf')
    const records = withTrades(book({ instruments: [etf] }), [trade('buy', BROKER, etf, '2026-01-05', '10', '100', '0'), trade('sell', BROKER, etf, '2026-12-30', '10', '105', '0')])

    const [sale] = capitalGainsYear(records, EXAMPLE_RATES, 2027).sales
    // TARGET is closed on 1 Jan, so two TARGET working days after Wednesday 30 Dec is Monday 4 Jan.
    expect([sale!.settles, sale!.settlesNextYear, sale!.gain]).toEqual(['2027-01-04', true, euros(50)])
    expect(capitalGainsYear(records, EXAMPLE_RATES, 2026).sales).toEqual([])
    expect(taxYearsOf(records, civil('2027-03-02'))).toEqual([2027])
  })

  it("marks a JOPPD dated 31 December with the year's two digits and the day of the year, 366 in a leap year", () => {
    expect([2024, 2025, 2026, 2028].map((year) => capitalGainsYear(exampleYear(), EXAMPLE_RATES, year).reportMark)).toEqual(['24366', '25365', '26365', '28366'])
  })

  it("taxes 2023's gains at 10% before the city's surtax", () => {
    const etf = instrument('etf')
    const records = book({ instruments: [etf], trades: [trade('buy', BROKER, etf, '2023-01-09', '10', '100', '0'), trade('sell', BROKER, etf, '2023-06-01', '10', '110', '0')] })

    // 100.00 of gain on a lot under two years, and 10% of it is 10.00, with the surtax of the city on top.
    const year = capitalGainsYear(records, EXAMPLE_RATES, 2023)
    expect([...figuresOf(year), year.rules.rules.surtax, year.rules.ownRow, year.reportMark, year.due]).toEqual([100, 0, 100, 10, 0, 0, true, true, '23365', '2024-02-29'])
    expect([year.surtax, year.payout]).toEqual([{ kind: 'no-city' }, euros(90)])
    expect(rulesOf(2024).rules.surtax).toBe(false)
  })

  it("adds the surtax of the owner's 2023 city on top of the tax and takes it off field 16.2", () => {
    const etf = instrument('etf')
    const trades = [trade('buy', BROKER, etf, '2023-01-09', '10', '100', '0'), trade('sell', BROKER, etf, '2023-06-01', '10', '110', '0')]
    const inCity = (code: string) => capitalGainsYear(book({ instruments: [etf], trades, settings: [settingRow(SETTING_RECORDS, SURTAX_CITY_2023_KEY, code)] }), EXAMPLE_RATES, 2023)

    // Zagreb's 18% of the 10.00 tax is 1.80, so field 16.2 is 100.00 − 10.00 − 1.80 = 88.20.
    const zagreb = inCity('133')
    expect([zagreb.surtax.kind === 'due' ? zagreb.surtax.amount : null, zagreb.payout, taxWithSurtax(zagreb.tax, zagreb.surtax)]).toEqual([euros(1.8), euros(88.2), euros(11.8)])
    // A city Porezna's table leaves out set no surtax, and a code the table lacks counts as no answer.
    const unlisted = inCity('none')
    expect([unlisted.surtax.kind === 'due' ? unlisted.surtax.amount : null, unlisted.payout]).toEqual([euros(0), euros(90)])
    expect(inCity('999').surtax).toEqual({ kind: 'no-city' })
  })

  it('leaves the surtax out of a year after 2023, whatever city is saved', () => {
    const etf = instrument('etf')
    const records = book({
      instruments: [etf],
      trades: [trade('buy', BROKER, etf, '2026-01-05', '10', '100', '0'), trade('sell', BROKER, etf, '2026-02-02', '10', '110', '0')],
      settings: [settingRow(SETTING_RECORDS, SURTAX_CITY_2023_KEY, '133')],
    })

    const year = capitalGainsYear(records, EXAMPLE_RATES, 2026)
    expect([year.surtax, year.tax, year.payout]).toEqual([{ kind: 'none' }, euros(12), euros(88)])
  })

  it('works out no year before 2023 and lists it apart', () => {
    const etf = instrument('etf')
    const records = book({
      instruments: [etf],
      trades: [trade('buy', BROKER, etf, '2021-01-11', '10', '100', '0'), trade('sell', BROKER, etf, '2022-06-01', '5', '110', '0'), trade('sell', BROKER, etf, '2023-06-01', '5', '110', '0')],
    })

    expect([taxYearsOf(records, civil('2026-10-30')), yearsWithoutRules(records)]).toEqual([[2026, 2023], [2022]])
    expect(() => rulesOf(2022)).toThrow(RangeError)
  })

  it("uses 2026's rules for 2027, which has no row yet, and says so", () => {
    expect(rulesOf(2027)).toEqual({ rules: { year: 2026, gainsRate: 12, incomeRate: 12, usWithholding: 30, usTreaty: false, surtax: false }, ownRow: false })
    expect(rulesOf(2026).ownRow).toBe(true)
    expect(capitalGainsYear(exampleYear(), EXAMPLE_RATES, 2027).rules.ownRow).toBe(false)
  })

  it('offers each year with a sale or a payment, and the year whose JOPPD is due next', () => {
    expect(taxYearsOf(exampleYear(), civil('2027-02-15'))).toEqual([2026])
    expect(taxYearsOf(exampleYear(), civil('2027-03-02'))).toEqual([2027, 2026])
  })
})
