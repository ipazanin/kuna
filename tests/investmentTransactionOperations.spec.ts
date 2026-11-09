// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { INVESTMENTS_OPERATIONS } from '../src/apps/investments/assistant/operations/investmentsOperations'
import { ATTACHMENT_REF } from '../src/shared/app/assistantOperations'
import { words as transactionWords } from '../src/apps/investments/transactions/presentation/words'
import { decimalText } from '../src/shared/money/decimal'
import { DESK, EXAMPLE_RECORDS, investmentsDesk } from './fixtures/investmentsDesk'
import type { InvestmentsDesk } from './fixtures/investmentsDesk'
import { USD, rateBookOf } from './fixtures/investments'
import { forgetCaches } from './fixtures/writeBack'

const used = new Set<string>()
afterEach(async () => forgetCaches(used))

const bookOf = ({ store }: InvestmentsDesk) => store.state.workbook!.book

/** The ECB's dollar rate in the week the examples fall in, which a rate given as null takes. */
const OCTOBER_RATES = rateBookOf(new Map([[USD, [['2026-10-09', '1.0912']] as const]]))

/** The example's input with each record it names as a ref the chat handed out. */
function exampleInput(desk: InvestmentsDesk, operation: (typeof INVESTMENTS_OPERATIONS)[number]): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(operation.example).map(([field, value]) => {
      const kind = operation.refs[field]
      return [field, kind !== undefined && kind !== ATTACHMENT_REF && typeof value === 'string' ? desk.ref(kind, EXAMPLE_RECORDS[value]!) : value]
    }),
  )
}

/** A trade step with every field given, and the ones named replaced. */
function addTrade(desk: InvestmentsDesk, fields: Readonly<Record<string, unknown>> = {}) {
  return {
    op: 'add-trade',
    input: {
      side: 'buy',
      account: desk.ref('investment-account', DESK.ONE.id),
      instrument: desk.ref('instrument', DESK.SHARE.id),
      date: '2026-10-12',
      quantity: '2',
      price: '150',
      fees: '1',
      rate: '1.08',
      note: '',
      ...fields,
    },
  }
}

describe('every Investments operation', () => {
  it.each(INVESTMENTS_OPERATIONS.map((operation) => [operation.name, operation] as const))(
    'has an example that passes the checks of the file, and an Accept with one Undo, or none for a card beside the books: %s',
    async (_name, operation) => {
      const desk = await investmentsDesk(used, OCTOBER_RATES)
      desk.history.complete = operation.name === 'forget-history'
      const before = JSON.stringify(bookOf(desk), (_key, value: unknown) => (typeof value === 'bigint' ? String(value) : value))

      const answer = await desk.propose([{ op: operation.name, input: exampleInput(desk, operation) }])

      expect(answer.text).toContain('The card shows')
      const [card] = desk.cards
      expect(card!.groups.length).toBeGreaterThan(0)
      expect(card!.groups.flatMap((group) => group.lines).every((line) => line.label !== '')).toBe(true)
      const result = await desk.accept()
      expect(result.kind).toBe('done')
      if (result.kind === 'done') {
        expect(result.undo === null).toBe(!card!.undoable)
        if (result.undo !== null) expect((await result.undo()).kind).toBe('undone')
      }
      expect(desk.history.complete).toBe(operation.name === 'forget-history')
      expect(JSON.stringify(bookOf(desk), (_key, value: unknown) => (typeof value === 'bigint' ? String(value) : value))).toBe(before)
    },
  )
})

describe('trades', () => {
  it('refuses a sale beyond what the account holds that day, as the trade dialog does, and writes nothing', async () => {
    const desk = await investmentsDesk(used)
    const trades = bookOf(desk).trades.length

    const answer = await desk.propose([addTrade(desk, { side: 'sell', quantity: '11' })])

    expect(answer.isError).toBe(true)
    expect(answer.text).toContain('Example Tech')
    expect(desk.cards).toHaveLength(0)
    expect(bookOf(desk).trades).toHaveLength(trades)
  })

  it('takes a sale of what the account holds, and refuses one from the other account, which holds none', async () => {
    const desk = await investmentsDesk(used)
    expect((await desk.propose([addTrade(desk, { side: 'sell', quantity: '10' })])).isError).toBe(false)
    expect((await desk.propose([addTrade(desk, { side: 'sell', quantity: '1', account: desk.ref('investment-account', DESK.TWO.id) })])).isError).toBe(true)
  })

  it("names each field the dialog would mark, in the dialog's words", async () => {
    const desk = await investmentsDesk(used)
    const answer = await desk.propose([addTrade(desk, { quantity: '0', rate: '0' })])
    expect(answer.isError).toBe(true)
    expect(answer.text).toContain(`quantity: ${transactionWords.errors.units}`)
    expect(answer.text).toContain(`rate: ${transactionWords.errors.rate}`)
  })

  it('reads a decimal only with a point and no grouping, so 1,5 is refused rather than read', async () => {
    const desk = await investmentsDesk(used)
    const answer = await desk.propose([addTrade(desk, { quantity: '1,5' })])
    expect(answer.isError).toBe(true)
    expect(answer.text).toContain('quantity is a decimal with a point')
  })

  it("fills a new trade's rate with the ECB's of its day, as the dialog does, and asks for one when there is none", async () => {
    const desk = await investmentsDesk(used, OCTOBER_RATES)
    expect((await desk.propose([addTrade(desk, { rate: null })])).isError).toBe(false)
    await desk.accept()
    expect(decimalText(bookOf(desk).trades.at(-1)!.rate!)).toBe('1.0912')

    const without = await investmentsDesk(used)
    const answer = await without.propose([addTrade(without, { rate: null })])
    expect(answer.text).toContain(`rate: ${transactionWords.errors.rate}`)
  })

  it('changes only what a step names, keeps the key of the rows an import brought, and turns a buy into a sale', async () => {
    const desk = await investmentsDesk(used)
    const answer = await desk.propose([
      {
        op: 'change-trade',
        input: { record: desk.ref('trade', DESK.FUND_BUY.id), side: 'sell', account: null, instrument: null, date: null, quantity: '1', price: null, fees: null, rate: null, note: null },
      },
    ])
    // Selling the only buy of the fund leaves nothing to sell from, so the dialog's check refuses it.
    expect(answer.isError).toBe(true)
    await desk.propose([
      {
        op: 'change-trade',
        input: { record: desk.ref('trade', DESK.FUND_BUY.id), side: null, account: null, instrument: null, date: null, quantity: '4', price: null, fees: null, rate: null, note: 'Checked' },
      },
    ])
    await desk.accept()
    const changed = bookOf(desk).trades.find((trade) => trade.id === DESK.FUND_BUY.id)!
    expect([decimalText(changed.quantity), decimalText(changed.price), changed.note]).toEqual(['4', '10', 'Checked'])
  })

  it('refuses deleting the buy a later spin-off and split count on when it would leave a sale or a lot without units', async () => {
    const desk = await investmentsDesk(used)
    await desk.propose([addTrade(desk, { side: 'sell', quantity: '10', date: '2026-10-12' })])
    await desk.accept()
    const answer = await desk.propose([{ op: 'delete-trade', input: { record: desk.ref('trade', DESK.SHARE_BUY.id) } }])
    expect(answer.isError).toBe(true)
  })
})

describe('income and cash', () => {
  it('refuses more tax withheld than the gross, and a reversal with no note', async () => {
    const desk = await investmentsDesk(used)
    const income = (fields: Readonly<Record<string, unknown>>) => ({
      op: 'add-income',
      input: {
        kind: 'dividend',
        account: desk.ref('investment-account', DESK.ONE.id),
        instrument: desk.ref('instrument', DESK.SHARE.id),
        date: '2026-10-15',
        currency: 'USD',
        gross: '3.2',
        withheld: '0.48',
        reverses: null,
        rate: '1.08',
        note: '',
        ...fields,
      },
    })
    expect((await desk.propose([income({ withheld: '4' })])).text).toContain(`withheld: ${transactionWords.errors.withheld}`)
    expect((await desk.propose([income({ reverses: 'yes' })])).text).toContain(`note: ${transactionWords.errors.reversalNote}`)
    expect((await desk.propose([income({ reverses: 'yes', note: 'Reverses the March dividend' })])).isError).toBe(false)
    await desk.accept()
    expect(decimalText(bookOf(desk).income.at(-1)!.gross)).toBe('-3.2')
  })
})

describe('in Croatian', () => {
  it("reads a step's decimals and grouped amounts through the dialog's Croatian fields, for a trade and an income", async () => {
    vi.resetModules()
    vi.doMock('../src/shared/text/language', async (original) => ({ ...(await original<object>()), language: 'hr', intlLocale: 'hr-HR' }))
    const croatian = await import('./fixtures/investmentsDesk')
    const { words: croatianWords } = await import('../src/apps/investments/transactions/presentation/words')
    vi.doUnmock('../src/shared/text/language')
    const desk = await croatian.investmentsDesk(used)
    expect(croatianWords.errors.units).not.toBe(transactionWords.errors.units)
    expect((await desk.propose([addTrade(desk, { quantity: '0' })])).text).toContain(`quantity: ${croatianWords.errors.units}`)

    const trade = await desk.propose([addTrade(desk, { quantity: '1.5', price: '1234.5', fees: '1234.5', rate: '1.0875' })])
    expect(trade.isError).toBe(false)
    await desk.accept()
    const bought = bookOf(desk).trades.at(-1)!
    expect([bought.quantity, bought.price, bought.fees, bought.rate].map((figure) => decimalText(figure!))).toEqual(['1.5', '1234.5', '1234.5', '1.0875'])

    const income = {
      kind: 'dividend',
      account: desk.ref('investment-account', croatian.DESK.ONE.id),
      instrument: desk.ref('instrument', croatian.DESK.SHARE.id),
      date: '2026-10-15',
      currency: 'USD',
      gross: '1234.5',
      withheld: '185.18',
      reverses: null,
      rate: '1.0875',
      note: '',
    }
    expect((await desk.propose([{ op: 'add-income', input: income }])).isError).toBe(false)
    await desk.accept()
    const paid = bookOf(desk).income.at(-1)!
    expect([paid.gross, paid.withheld].map((figure) => decimalText(figure!))).toEqual(['1234.5', '185.18'])
  })
})

describe('add-holding', () => {
  it('writes the buy and the deposit that paid for it, and one Undo takes both back', async () => {
    const desk = await investmentsDesk(used)
    const [trades, movements] = [bookOf(desk).trades.length, bookOf(desk).cashMovements.length]
    await desk.propose([
      {
        op: 'add-holding',
        input: {
          account: desk.ref('investment-account', DESK.TWO.id),
          instrument: desk.ref('instrument', DESK.FUND.id),
          date: '2025-03-03',
          quantity: '10',
          price: '9.5',
          fees: null,
          rate: null,
          note: '',
        },
      },
    ])
    const result = await desk.accept()
    const deposit = bookOf(desk).cashMovements.at(-1)!
    expect([deposit.kind, decimalText(deposit.amount), deposit.account, deposit.note]).toEqual(['deposit', '95', DESK.TWO.id, transactionWords.dialog.alreadyHeldNote])
    expect(bookOf(desk).trades.at(-1)!.side).toBe('buy')
    if (result.kind === 'done') await result.undo!()
    expect([bookOf(desk).trades.length, bookOf(desk).cashMovements.length]).toEqual([trades, movements])
  })
})

describe('accounts and instruments', () => {
  it('trades in an account the same card adds, by its $ name', async () => {
    const desk = await investmentsDesk(used)
    const answer = await desk.propose([{ op: 'add-account', input: { name: 'New broker', note: '' }, as: '$new' }, addTrade(desk, { account: '$new', side: 'buy' })])
    expect(answer.isError).toBe(false)
    await desk.accept()
    const added = bookOf(desk).accounts.find((account) => account.name === 'New broker')!
    expect(bookOf(desk).trades.at(-1)!.account).toBe(added.id)
  })

  it('refuses deleting an account that records name, and a blank name', async () => {
    const desk = await investmentsDesk(used)
    expect((await desk.propose([{ op: 'delete-account', input: { account: desk.ref('investment-account', DESK.ONE.id) } }])).isError).toBe(true)
    expect((await desk.propose([{ op: 'add-account', input: { name: ' ', note: '' } }])).isError).toBe(true)
  })

  it("says on the card that Accept fetches a priced holding's closes, and starts that fetch once the write is done", async () => {
    const desk = await investmentsDesk(used)
    const instrument = (prices: string) => ({
      op: 'add-instrument',
      input: {
        name: `Listed ${prices}`,
        symbol: 'LST',
        type: 'share',
        class: null,
        isin: null,
        exchange: null,
        currency: 'USD',
        prices,
        sourceSymbol: null,
        sector: null,
        country: null,
        ter: null,
        distribution: null,
        note: '',
        sectors: [],
        countries: [],
      },
    })
    await desk.propose([instrument('manual')])
    expect(desk.cards[0]!.outside).toEqual([])
    await desk.propose([instrument('twelvedata')])
    expect(desk.cards[1]!.outside).toHaveLength(1)
    expect(desk.cards[1]!.outside[0]).toContain('Listed twelvedata')
    expect((await desk.accept(1)).kind).toBe('done')
    expect(desk.fetches.count).toBe(1)
  })

  it('says nothing about fetching closes for a change that keeps the price source and ticker', async () => {
    const desk = await investmentsDesk(used)
    const fields = ['name', 'symbol', 'type', 'class', 'isin', 'exchange', 'currency', 'prices', 'sourceSymbol', 'sector', 'country', 'ter', 'distribution']
    const change = (changed: Readonly<Record<string, unknown>>) => ({
      op: 'change-instrument',
      input: { instrument: desk.ref('instrument', DESK.SHARE.id), ...Object.fromEntries(fields.map((name) => [name, null])), note: 'Checked', sectors: [], countries: [], mix: 'keep', ...changed },
    })

    await desk.propose([change({})])
    await desk.propose([change({ sourceSymbol: 'EXT.US' })])

    expect(desk.cards.map((card) => card.outside.length)).toEqual([0, 1])
  })

  it("refuses a fund's mix that does not add up to 100, and an ISIN another holding has", async () => {
    const desk = await investmentsDesk(used)
    const change = (fields: Readonly<Record<string, unknown>>) => ({
      op: 'change-instrument',
      input: {
        instrument: desk.ref('instrument', DESK.FUND.id),
        ...Object.fromEntries(
          ['name', 'symbol', 'type', 'class', 'isin', 'exchange', 'currency', 'prices', 'sourceSymbol', 'sector', 'country', 'ter', 'distribution', 'note'].map((name) => [name, null]),
        ),
        sectors: [],
        countries: [],
        mix: 'keep',
        ...fields,
      },
    })
    expect((await desk.propose([change({ countries: [{ group: 'US', percent: '60' }], mix: 'replace' })])).isError).toBe(true)
    await desk.propose([change({ isin: 'US0378331005' })])
    await desk.accept()
    const answer = await desk.propose([{ ...change({ isin: 'US0378331005' }), input: { ...change({ isin: 'US0378331005' }).input, instrument: desk.ref('instrument', DESK.UNHELD.id) } }])
    expect(answer.isError).toBe(true)
  })
})
