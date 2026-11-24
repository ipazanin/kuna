// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import { bookedWorth, brokerWorthKept, tradeTotal } from '../src/apps/investments/holdings/domain/lots'
import { NO_ANSWERS, workbookDryRun } from '../src/apps/investments/imports/domain/importDryRun'
import { transcribedRows } from '../src/apps/investments/imports/domain/transcribedRows'
import { IBKR_FLEX_RECIPE } from '../src/apps/investments/mail/domain/ibkrFlexRecipe'
import { reportRows } from '../src/apps/investments/mail/domain/reportRows'
import { flexReportOf } from '../src/apps/investments/mail/infrastructure/fake/sampleFlexReport'
import { TRADE_CODEC } from '../src/apps/investments/workbook/domain/tradeReading'
import { parseCivilDate } from '../src/shared/calendar/civilDate'
import { decimalText } from '../src/shared/money/decimal'
import { runRecipe } from '../src/shared/recipes/domain/runRecipe'
import { readRecipeFile } from '../src/shared/recipes/infrastructure/recipeFile'
import { storedFieldsOfValues } from '../src/shared/storage/domain/storedFields'
import { USD, account, book, decimal, instrument, rateBookOf, trade } from './fixtures/investments'

const UNIT = { kind: 'unit' } as const
const DAY = parseCivilDate('2026-10-05')!
const ACCOUNT = account('kuna-ibkr', 'Kuna IBKR', [{ source: 'mail', from: parseCivilDate('2026-01-01')! }])
const PFE = instrument('pfe', { isin: 'US7170811035', currency: USD })
const RATES = rateBookOf(new Map([[USD, [['2026-10-01', '1.10']]]]))
const PFE_SALE = trade('sell', ACCOUNT, PFE, '2024-09-10', '5', '29.605', '0.351462345', '1.1')

describe("the worth the broker booked for a trade's units", () => {
  it('is units × price to the cent unless the broker booked another', () => {
    expect(decimalText(bookedWorth(UNIT, decimal('5'), decimal('29.605')))).toBe('148.03')
    expect(decimalText(bookedWorth(UNIT, decimal('5'), decimal('29.605'), decimal('148.025')))).toBe('148.025')
  })

  it.each([
    ['148.025', '148.025'],
    ['148.03', undefined],
    [null, undefined],
  ])('keeps a broker worth of %s as %s', (worth, kept) => {
    const brokerWorth = brokerWorthKept(UNIT, decimal('5'), decimal('29.605'), worth === null ? null : decimal(worth))
    expect(brokerWorth === undefined ? undefined : decimalText(brokerWorth)).toBe(kept)
  })

  it("moves the broker's worth less the fees, so a sale's cash is IBKR's to the last decimal", () => {
    expect(decimalText(tradeTotal(PFE_SALE, UNIT))).toBe('147.678537655')
    expect(decimalText(tradeTotal({ ...PFE_SALE, brokerWorth: decimal('148.025') }, UNIT))).toBe('147.673537655')
  })

  it('is stored as broker_worth and read back, and a trade without one stores nothing for it', () => {
    const kept = { ...PFE_SALE, brokerWorth: decimal('148.025') }
    const fields = TRADE_CODEC.fieldsOf(kept)
    expect(fields).toMatchObject({ broker_worth: '148.025' })
    expect(TRADE_CODEC.make(storedFieldsOfValues(fields), kept.id)).toEqual(kept)
    expect(TRADE_CODEC.fieldsOf(PFE_SALE)).not.toHaveProperty('broker_worth')
    expect(TRADE_CODEC.make(storedFieldsOfValues(TRADE_CODEC.fieldsOf(PFE_SALE)), PFE_SALE.id)).not.toHaveProperty('brokerWorth')
    expect(() => TRADE_CODEC.make(storedFieldsOfValues({ ...fields, broker_worth: '0' }), kept.id)).toThrow()
  })
})

describe('an import that knows the worth the broker booked', () => {
  function mailedTrade(values: Readonly<Record<string, string>>) {
    const report = flexReportOf(DAY, {
      trades: [{ transactionID: '1', assetCategory: 'STK', symbol: 'PFE', isin: 'US7170811035', currency: 'USD', dateTime: '20261005;103015', taxes: '0', notes: '', ...values }],
    })
    const read = readRecipeFile(IBKR_FLEX_RECIPE, new TextEncoder().encode(report).buffer as ArrayBuffer)
    if (read.kind !== 'read') throw new Error(`It did not read: ${read.misfit.kind}`)
    const run = runRecipe(IBKR_FLEX_RECIPE, read.rows)
    if (run.kind !== 'read') throw new Error(`It does not fit: ${run.misfit.kind}`)
    const rows = reportRows(IBKR_FLEX_RECIPE, [{ fileName: 'report.xml', run }], { leftOut: [] }, { kind: 'mailed', since: null })
    const held = book({ accounts: [ACCOUNT], instruments: [PFE], trades: [trade('buy', ACCOUNT, PFE, '2024-01-05', '10', '30', '1', '1.1')] })
    const dryRun = workbookDryRun(rows, { book: held, rates: RATES, answers: { ...NO_ANSWERS, accounts: new Map([['U0000001', ACCOUNT]]), instruments: new Map([['US7170811035', PFE]]) } })
    const made = dryRun.entries.flatMap((entry) => (entry.outcome.kind === 'new' && entry.outcome.imported.kind === 'trade' ? [entry.outcome.imported.record] : []))
    return made[0]!
  }

  it("keeps a mailed report's proceeds that are not units × price to the cent, and takes IBKR's commission as the fees", () => {
    const sale = mailedTrade({ buySell: 'SELL', quantity: '-5', tradePrice: '29.605', proceeds: '148.025', ibCommission: '-0.351462345', ibCommissionCurrency: 'USD', netCash: '147.673537655' })
    expect(sale).toMatchObject({ brokerWorth: decimal('148.025'), fees: decimal('0.351462345') })
  })

  it('keeps no worth of its own when IBKR booked units × price to the cent', () => {
    const buy = mailedTrade({ buySell: 'BUY', quantity: '81', tradePrice: '122.6733', proceeds: '-9936.54', ibCommission: '-5.001193617', ibCommissionCurrency: 'USD', netCash: '-9941.541193617' })
    expect(buy).not.toHaveProperty('brokerWorth')
    expect(buy).toMatchObject({ fees: decimal('5.001193617') })
  })

  it("reads the worth of a row the AI copied, such as an activity statement's Proceeds, and refuses one it cannot read", () => {
    const copied = {
      date: '2024-09-10',
      type: 'SELL',
      symbol: 'PFE',
      isin: '',
      name: '',
      quantity: '-5',
      price: '29.605',
      currency: 'USD',
      gross: null,
      commission: null,
      commissionCurrency: null,
      netCash: '147.673537655',
      counterCurrency: null,
      counterAmount: null,
      note: '',
    } as const
    const file = (worth: string | null) => ({ fileName: 'statement.csv', broker: 'IBKR', account: 'ibkr', rows: [{ ...copied, worth }], balances: [] })
    const read = transcribedRows(file('148.025'), 'import')
    expect(read.kind === 'read' && read.rows.rows[0]!.worth).toEqual(decimal('148.025'))
    expect(transcribedRows(file('148,025'), 'import')).toMatchObject({ kind: 'refused', rows: [{ problem: { kind: 'unreadable', field: 'worth' } }] })
  })
})
