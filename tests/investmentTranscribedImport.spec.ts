// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { DESK, investmentsDesk } from './fixtures/investmentsDesk'
import type { InvestmentsDesk } from './fixtures/investmentsDesk'
import { USD, rateBookOf } from './fixtures/investments'
import { forgetCaches } from './fixtures/writeBack'
import type { ChatAttachment } from '../src/shared/ai/domain/chatAttachments'
import { decimalText } from '../src/shared/money/decimal'

const used = new Set<string>()
afterEach(async () => forgetCaches(used))

const bookOf = ({ store }: InvestmentsDesk) => store.state.workbook!.book

/** The ECB's dollar rate from before the desk's share was bought. */
const DOLLAR_RATES = rateBookOf(new Map([[USD, [['2026-01-02', '1.10']] as const]]))

const BLANK = {
  symbol: '',
  isin: '',
  name: '',
  quantity: null,
  price: null,
  currency: null,
  gross: null,
  commission: null,
  commissionCurrency: null,
  netCash: null,
  counterCurrency: null,
  counterAmount: null,
  note: '',
}

function deposit(date: string, netCash = '500') {
  return { ...BLANK, date, type: 'DEPOSIT', currency: 'EUR', netCash }
}

/** A trade of the desk's share, which Kuna holds ten of in Broker One from 2026-01-10. */
function shareTrade(type: 'BUY' | 'SELL', date: string, quantity: string, netCash: string) {
  return { ...BLANK, date, type, symbol: 'SHARE', quantity, price: '100', currency: 'USD', netCash }
}

/** Euros changed into dollars, with a commission. */
function exchange(commission: string, commissionCurrency: string | null) {
  return { ...BLANK, date: '2026-04-01', type: 'FX', currency: 'EUR', netCash: '-100', counterCurrency: 'USD', counterAmount: '108', commission, commissionCurrency }
}

/** A PDF statement attached to the chat, which reaches the model whole, so the AI copies its rows. */
function statement(desk: InvestmentsDesk, id: string, name: string): void {
  const attached: ChatAttachment = { id, kind: 'pdf', name, bytes: new Uint8Array(), original: new Blob(), pages: 1, sent: null, reading: { kind: 'whole' } }
  desk.attachments.push(attached)
}

async function statementDesk(rates: Parameters<typeof investmentsDesk>[1] = null): Promise<InvestmentsDesk> {
  const desk = await investmentsDesk(used, rates)
  statement(desk, 'a4', 'statement.pdf')
  statement(desk, 'a5', 'statement (1).pdf')
  return desk
}

function transcribed(desk: InvestmentsDesk, rows: readonly unknown[], fields: Readonly<Record<string, unknown>> = {}) {
  return {
    op: 'import-transcribed',
    input: { file: 'a4', account: desk.ref('investment-account', DESK.ONE.id), broker: 'Example Broker', lookAlikes: 'ask', rows, balances: [], ...fields },
  }
}

const warningsOf = (desk: InvestmentsDesk): string =>
  desk.cards
    .at(-1)!
    .groups.flatMap((group) => group.lines.map((line) => line.warning ?? ''))
    .join(' ')

describe('rows the AI copied from a file', () => {
  it('imports into the account named, says the AI read them and Kuna could not check they add up, and adds nothing when copied again', async () => {
    const desk = await statementDesk(DOLLAR_RATES)
    const movements = bookOf(desk).cashMovements.length
    const step = transcribed(desk, [deposit('2026-04-01'), deposit('2026-04-01'), deposit('2026-04-02', '250')])

    expect((await desk.propose([step])).isError).toBe(false)
    expect(warningsOf(desk)).toContain('The AI read 3 rows from statement.pdf')
    expect(warningsOf(desk)).toContain('could not check')
    await desk.accept()
    const added = bookOf(desk).cashMovements.slice(movements)
    expect(added).toHaveLength(3)
    expect(new Set(added.map((movement) => movement.account))).toEqual(new Set([DESK.ONE.id]))

    expect((await desk.propose([step])).text).toContain('Nothing would change')
  })

  it('counts the rows Kuna has already on the card', async () => {
    const desk = await statementDesk()
    await desk.propose([transcribed(desk, [deposit('2026-04-01'), deposit('2026-04-02', '250')])])
    await desk.accept()
    expect((await desk.propose([transcribed(desk, [deposit('2026-04-01'), deposit('2026-04-02', '250'), deposit('2026-04-03', '100')])])).isError).toBe(false)
    expect(warningsOf(desk)).toContain('2 rows are in Kuna already and are skipped.')
  })

  it('refuses a card that holds only part of a day Kuna has rows of from the same file, and takes the whole day again with its second equal row asked about', async () => {
    const desk = await statementDesk()
    const movements = bookOf(desk).cashMovements.length
    await desk.propose([transcribed(desk, [deposit('2026-04-01'), deposit('2026-04-01', '250')])])
    await desk.accept()

    const part = await desk.propose([transcribed(desk, [deposit('2026-04-01', '250'), deposit('2026-04-01', '100')])])
    expect(part.isError).toBe(true)
    expect(part.text).toContain('only part of those days')

    const day = [deposit('2026-04-01'), deposit('2026-04-01', '250'), deposit('2026-04-01', '250'), deposit('2026-04-01', '100')]
    expect((await desk.propose([transcribed(desk, day)])).isError).toBe(false)
    expect(warningsOf(desk)).toContain('2 rows are in Kuna already and are skipped.')
    expect(warningsOf(desk)).toContain('1 row looks like a record Kuna has from another file')
    expect((await desk.propose([transcribed(desk, day, { lookAlikes: 'import' })])).isError).toBe(false)
    await desk.accept()
    expect(
      bookOf(desk)
        .cashMovements.slice(movements)
        .map((movement) => decimalText(movement.amount)),
    ).toEqual(['500', '250', '250', '100'])
  })

  it('makes a new account named after the broker when none is named', async () => {
    const desk = await statementDesk()
    const step = transcribed(desk, [deposit('2026-04-01')], { file: null, account: null, broker: 'Trading Place' })
    expect((await desk.propose([step])).isError).toBe(false)
    expect(warningsOf(desk)).toContain('from the chat')
    await desk.accept()
    expect(bookOf(desk).accounts.map((account) => account.name)).toContain('Trading Place')
  })

  it('refuses a new account while Kuna has one named after the broker, naming it', async () => {
    const desk = await statementDesk()
    const answer = await desk.propose([transcribed(desk, [deposit('2026-04-01')], { account: null, broker: ' broker one ' })])
    expect(answer.isError).toBe(true)
    expect(answer.text).toContain(`Kuna has an account called ${DESK.ONE.name}`)
    expect(answer.text).toContain('name it in account')
  })

  it('asks about a trade that looks like one Kuna has from another file, with a count on the card, and imports it when told to', async () => {
    const desk = await statementDesk(DOLLAR_RATES)
    const trades = bookOf(desk).trades.length
    const rows = [shareTrade('BUY', '2026-01-10', '10', '-1000'), deposit('2026-04-01')]

    expect((await desk.propose([transcribed(desk, rows)])).isError).toBe(false)
    expect(warningsOf(desk)).toContain('1 row looks like a record Kuna has from another file')
    await desk.accept()
    expect(bookOf(desk).trades).toHaveLength(trades)

    const alone = await desk.propose([transcribed(desk, rows)])
    expect(alone.isError).toBe(true)
    expect(alone.text).toContain('lookAlikes import')

    expect((await desk.propose([transcribed(desk, rows, { lookAlikes: 'import' })])).isError).toBe(false)
    await desk.accept()
    expect(bookOf(desk).trades).toHaveLength(trades + 1)
  })

  it('compares a trade for a new account with the trades of every account', async () => {
    const desk = await statementDesk(DOLLAR_RATES)
    await desk.propose([transcribed(desk, [shareTrade('BUY', '2026-01-10', '10', '-1000'), deposit('2026-04-01', '77')], { account: null, broker: 'Other Broker' })])
    expect(warningsOf(desk)).toContain('1 row looks like a record Kuna has from another file')
  })

  it('asks about income and a deposit that look like ones Kuna has, instead of taking them as new from another file', async () => {
    const desk = await statementDesk(DOLLAR_RATES)
    const movements = bookOf(desk).cashMovements.length
    const income = bookOf(desk).income.length
    const dividend = { ...BLANK, date: '2026-03-15', type: 'DIVIDEND', symbol: 'SHARE', currency: 'USD', gross: '3.2', netCash: '3.2' }
    await desk.propose([transcribed(desk, [deposit('2026-04-01')])])
    await desk.accept()

    const again = await desk.propose([transcribed(desk, [deposit('2026-04-01'), dividend], { file: 'a5' })])
    expect(again.isError).toBe(true)
    expect(again.text).toContain('Rows 1, 2 look like records Kuna has from another file')

    expect((await desk.propose([transcribed(desk, [deposit('2026-04-01'), dividend], { file: 'a5', lookAlikes: 'import' })])).isError).toBe(false)
    await desk.accept()
    expect(bookOf(desk).cashMovements).toHaveLength(movements + 2)
    expect(bookOf(desk).income).toHaveLength(income + 1)
  })

  it('checks the rows against the cash balances the file prints, and says so on the card when they add up', async () => {
    const desk = await statementDesk()
    const rows = [deposit('2026-04-01'), deposit('2026-04-02', '250')]

    expect((await desk.propose([transcribed(desk, rows, { balances: [{ currency: 'EUR', opening: '1000', closing: '1750' }] })])).isError).toBe(false)
    expect(warningsOf(desk)).toContain('Their cash adds up to the balances the file prints')
    expect(warningsOf(desk)).not.toContain('could not check')

    const off = await desk.propose([transcribed(desk, rows, { balances: [{ currency: 'EUR', opening: '1000', closing: '1700' }] })])
    expect(off.isError).toBe(true)
    expect(off.text).toContain('Cash in EUR does not add up: from the opening 1000 the rows reach 1750, but the closing is 1700, a gap of -50.')
  })

  it('keeps the warning that Kuna could not check when a currency the rows move has no printed balance', async () => {
    const desk = await statementDesk(DOLLAR_RATES)
    const rows = [deposit('2026-04-01'), exchange('1', 'EUR')]
    expect((await desk.propose([transcribed(desk, rows, { balances: [{ currency: 'EUR', opening: '0', closing: '400' }] })])).isError).toBe(false)
    expect(warningsOf(desk)).toContain('could not check')
  })

  it("keeps an exchange's commission in the currency the row names, and refuses one below zero, without one or in a third currency", async () => {
    const desk = await statementDesk(DOLLAR_RATES)
    expect((await desk.propose([transcribed(desk, [exchange('1.5', 'USD')])])).isError).toBe(false)
    await desk.accept()
    expect(bookOf(desk).exchanges.at(-1)!.fees).toEqual({ amount: 1_500_000_000_000n, currency: 'USD' })

    const below = await desk.propose([transcribed(desk, [exchange('-1.5', 'USD')])])
    expect(below.text).toContain('Row 1: commission is below zero')
    const none = await desk.propose([transcribed(desk, [exchange('1.5', null)])])
    expect(none.text).toContain('Row 1: commissionCurrency is missing')
    const third = await desk.propose([transcribed(desk, [exchange('1.5', 'GBP')])])
    expect(third.text).toContain('FEE row of its own')
  })

  it('refuses a file Kuna reads itself, naming the operation that imports it', async () => {
    const desk = await statementDesk()
    const answer = await desk.propose([transcribed(desk, [deposit('2026-04-01')], { file: 'a2' })])
    expect(answer.isError).toBe(true)
    expect(answer.text).toContain('Propose import-closes with it')
  })

  it('keeps a sale beyond the units held waiting, saying why', async () => {
    const desk = await statementDesk(DOLLAR_RATES)
    const trades = bookOf(desk).trades.length
    expect((await desk.propose([transcribed(desk, [shareTrade('SELL', '2026-04-01', '50', '5000'), deposit('2026-04-01')])])).isError).toBe(false)
    expect(warningsOf(desk)).toContain('1 row waits and is not imported. Sells or moves more units than its account holds on its day')
    await desk.accept()
    expect(bookOf(desk).trades).toHaveLength(trades)
  })

  it('refuses while the prices file lacks an ECB rate the rows need, pointing to fetch-prices', async () => {
    const desk = await statementDesk()
    const answer = await desk.propose([transcribed(desk, [shareTrade('BUY', '2026-04-01', '1', '-100')])])
    expect(answer.isError).toBe(true)
    expect(answer.text).toContain('fetch-prices')
  })

  it('refuses a split the card cannot answer, naming the holding and the operation that adds it', async () => {
    const desk = await statementDesk(DOLLAR_RATES)
    const answer = await desk.propose([transcribed(desk, [{ ...BLANK, date: '2026-06-10', type: 'SPLIT', symbol: 'SHARE', quantity: '30' }])])
    expect(answer.isError).toBe(true)
    expect(answer.text).toContain('add-split')
    expect(desk.cards).toHaveLength(0)
  })

  it('refuses a row Kuna cannot read by its number and field, quoting nothing that was copied', async () => {
    const desk = await statementDesk()
    const answer = await desk.propose([transcribed(desk, [deposit('2026-04-01'), deposit('2026-04-02', 'five hundred')])])
    expect(answer.isError).toBe(true)
    expect(answer.text).toContain('Row 2: netCash cannot be read.')
    expect(answer.text).not.toContain('five hundred')
  })

  it('refuses a type or a look-alike answer outside its list, naming every value it takes', async () => {
    const desk = await statementDesk()
    const type = await desk.propose([transcribed(desk, [{ ...deposit('2026-04-01'), type: 'PURCHASE' }])])
    expect(type.isError).toBe(true)
    expect(type.text).toContain('BUY')
    expect(type.text).toContain('SPINOFF')
    const lookAlikes = await desk.propose([transcribed(desk, [deposit('2026-04-01')], { lookAlikes: 'skip' })])
    expect(lookAlikes.isError).toBe(true)
    expect(lookAlikes.text).toContain('ask')
    expect(lookAlikes.text).toContain('import')
  })

  it('splits into cards of fewer days, or one day in parts, when the rows make more changes than a card holds', async () => {
    const desk = await statementDesk()
    const rows = Array.from({ length: 201 }, (_, day) => deposit(new Date(Date.UTC(2026, 0, 1 + day)).toISOString().slice(0, 10), '10'))
    const answer = await desk.propose([transcribed(desk, rows)])
    expect(answer.isError).toBe(true)
    expect(answer.text).toContain('propose the rest on the next card')
    expect(answer.text).toContain('every row of that day again from its first')
    expect(answer.text).not.toContain('Propose fewer')
  })
})
