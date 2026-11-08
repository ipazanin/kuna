import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { words as mailWords } from '../src/apps/investments/mail/presentation/words'
import { words as pricesWords } from '../src/apps/investments/prices/presentation/words'
import { words } from '../src/apps/investments/assistant/words'
import { emptyPricesFile } from '../src/apps/investments/prices/domain/pricesFile'
import { plural } from '../src/shared/text/translation'
import { NOT_READ_OFF_A_PAGE } from '../src/shared/app/operationInput'
import { decimalText } from '../src/shared/money/decimal'
import { DEPOSIT_WORKBOOK, DESK, closesAttachment, investmentsDesk, workbookAttachment, workbookGrid } from './fixtures/investmentsDesk'
import type { InvestmentsDesk } from './fixtures/investmentsDesk'
import { forgetCaches } from './fixtures/writeBack'

const used = new Set<string>()
afterEach(async () => forgetCaches(used))

const bookOf = ({ store }: InvestmentsDesk) => store.state.workbook!.book

const IMPORT = { op: 'import-workbook', input: { file: 'a1', gone: 'keep' } }

const BROKER = { broker: 'IBKR', account: 'U0000009', sourceFile: 'activity.csv' } as const
const ABC = { yahooSymbol: 'ABC', brokerSymbol: 'ABC', isin: 'US0000000001' } as const
const NEWCO = { yahooSymbol: 'NEWCO', brokerSymbol: 'NEWCO' } as const

/** A deposit and a buy of ten ABC shares in euros, which a split or a spin-off follows. */
const HELD_ABC = [
  ['2026-01-02', { ...BROKER, type: 'DEPOSIT', currency: 'EUR', netCash: 5000 }],
  ['2026-01-06', { ...BROKER, ...ABC, type: 'BUY', quantity: 10, price: 100, currency: 'EUR', gross: -1000, netCash: -1000 }],
] as const

/** A day of 2026 counted from the first of January. */
function civilDay(day: number): string {
  return new Date(Date.UTC(2026, 0, 1 + day)).toISOString().slice(0, 10)
}

/** Two deposits at a new account, so a later workbook without the second leaves it gone. */
const TWO_DEPOSITS = workbookGrid([
  ['2026-03-02', { broker: 'IBKR', account: 'U0000009', sourceFile: 'activity.csv', type: 'DEPOSIT', currency: 'EUR', netCash: 1000 }],
  ['2026-03-09', { broker: 'IBKR', account: 'U0000009', sourceFile: 'activity.csv', type: 'DEPOSIT', currency: 'EUR', netCash: 500 }],
])

describe('the portfolio workbook', () => {
  it('imports what the Import dialog would with its defaults, in one write with one Undo, and adds nothing a second time', async () => {
    const desk = await investmentsDesk(used)
    const accounts = bookOf(desk).accounts.length
    expect((await desk.propose([IMPORT])).isError).toBe(false)
    expect(desk.cards[0]!.groups.map((group) => [group.verb, group.lines.length])).toEqual([
      ['add', 1],
      ['add', 1],
    ])
    const result = await desk.accept()
    expect(bookOf(desk).accounts.map((account) => account.name)).toContain('IBKR')

    expect((await desk.propose([IMPORT])).text).toContain('Nothing would change')
    if (result.kind === 'done') await result.undo!()
    expect(bookOf(desk).accounts).toHaveLength(accounts)
  })

  it('lists the records gone from the workbook, and deletes them only when asked', async () => {
    const desk = await investmentsDesk(used)
    desk.attachments.push(await workbookAttachment('a3', TWO_DEPOSITS))
    await desk.propose([{ op: 'import-workbook', input: { file: 'a3', gone: 'keep' } }])
    await desk.accept()
    const deposits = bookOf(desk).cashMovements.length

    desk.attachments.push(
      await workbookAttachment('a4', [
        ...DEPOSIT_WORKBOOK,
        ...workbookGrid([['2026-03-10', { broker: 'IBKR', account: 'U0000009', sourceFile: 'activity.csv', type: 'FEE', currency: 'EUR', netCash: -2 }]]).slice(1),
      ]),
    )
    await desk.propose([{ op: 'import-workbook', input: { file: 'a4', gone: 'keep' } }])
    const kept = desk.cards.at(-1)!
    expect(kept.groups[0]!.lines[0]!.warning).toContain('gone from the workbook')

    await desk.propose([{ op: 'import-workbook', input: { file: 'a4', gone: 'delete' } }])
    const deleting = desk.cards.at(-1)!
    expect(deleting.groups.map((group) => group.verb)).toContain('remove')
    await desk.accept()
    expect(bookOf(desk).cashMovements).toHaveLength(deposits)
  })

  it('refuses a photo, a CSV or a sheet with no Transactions tab, naming nothing of the file', async () => {
    const desk = await investmentsDesk(used)
    desk.attachments.push({ ...desk.attachments[0]!, id: 'a3', kind: 'photo' }, closesAttachment('a4', 'Ana Horvat.csv', 'Date,Close\n'))
    desk.attachments.push(await workbookAttachment('a5', [['Date', 'Close']], 'Ana Horvat.xlsx'))
    expect((await desk.propose([{ op: 'import-workbook', input: { file: 'a3', gone: 'keep' } }])).text).toBe(NOT_READ_OFF_A_PAGE)
    expect((await desk.propose([{ op: 'import-workbook', input: { file: 'a4', gone: 'keep' } }])).text).not.toContain('Ana')
    const sheet = await desk.propose([{ op: 'import-workbook', input: { file: 'a5', gone: 'keep' } }])
    expect(sheet.isError).toBe(true)
    expect(sheet.text).not.toContain('Ana')
  })

  it('refuses a split or a spin-off the Import dialog would ask about, naming the holdings and linking the dialog', async () => {
    const desk = await investmentsDesk(used)
    desk.attachments.push(await workbookAttachment('a3', workbookGrid([...HELD_ABC, ['2026-06-10', { ...BROKER, ...ABC, type: 'SPLIT', quantity: 30 }]])))
    desk.attachments.push(await workbookAttachment('a4', workbookGrid([...HELD_ABC, ['2026-07-01', { ...BROKER, ...NEWCO, type: 'SPINOFF', quantity: 4, price: 12, currency: 'EUR' }]])))
    for (const file of ['a3', 'a4']) {
      const answer = await desk.propose([{ op: 'import-workbook', input: { file, gone: 'keep' } }])
      expect(answer.isError).toBe(true)
      expect(answer.text).toContain(file === 'a3' ? 'ABC' : 'NEWCO')
      expect(answer.text).toContain(words.proposals.workbook.place)
    }
    expect(desk.cards).toHaveLength(0)
  })

  it('imports a spin-off whose row names its parent and cost share, which the dialog does not ask about', async () => {
    const desk = await investmentsDesk(used)
    desk.attachments.push(
      await workbookAttachment('a3', workbookGrid([...HELD_ABC, ['2026-07-01', { ...BROKER, ...NEWCO, type: 'SPINOFF', quantity: 4, price: 12, currency: 'EUR', spinOffFrom: 'ABC', costShare: 10 }]])),
    )
    expect((await desk.propose([{ op: 'import-workbook', input: { file: 'a3', gone: 'keep' } }])).isError).toBe(false)
    await desk.accept()
    expect(bookOf(desk).spinOffs.map((spinOff) => decimalText(spinOff.costShare))).toContain('0.1')
  })

  it('puts its warned line on the group of what it writes, whatever steps go before it', async () => {
    const desk = await investmentsDesk(used)
    desk.attachments.push(await workbookAttachment('a3', TWO_DEPOSITS))
    await desk.propose([{ op: 'import-workbook', input: { file: 'a3', gone: 'keep' } }])
    await desk.accept()
    desk.attachments.push(await workbookAttachment('a4', [...DEPOSIT_WORKBOOK, ...workbookGrid([['2026-03-10', { ...BROKER, type: 'FEE', currency: 'EUR', netCash: -2 }]]).slice(1)]))
    await desk.propose([
      { op: 'add-account', input: { name: 'Broker, long term', note: '' } },
      { op: 'import-workbook', input: { file: 'a4', gone: 'keep' } },
    ])
    const [accounts, movements] = desk.cards.at(-1)!.groups
    expect(accounts!.lines.every((line) => line.warning === null)).toBe(true)
    expect(movements!.lines[0]!.warning).toContain('gone from the workbook')
  })

  it('links Overview, Import for a workbook larger than a card holds', async () => {
    const desk = await investmentsDesk(used)
    const deposits = Array.from(
      { length: 201 },
      (_, day) => [civilDay(day), { broker: 'IBKR', account: 'U0000009', sourceFile: 'activity.csv', type: 'DEPOSIT', currency: 'EUR', netCash: 10 }] as const,
    )
    desk.attachments.push(await workbookAttachment('a3', workbookGrid(deposits)))
    const answer = await desk.propose([{ op: 'import-workbook', input: { file: 'a3', gone: 'keep' } }])
    expect(answer.isError).toBe(true)
    expect(answer.text).toContain('link Overview, Import')
    expect(answer.text).not.toContain('Propose fewer')
  })

  it('refuses while the prices file lacks an ECB rate the rows need, as the dialog fetches it first', async () => {
    const desk = await investmentsDesk(used)
    desk.attachments.push(await workbookAttachment('a3', workbookGrid([['2026-03-02', { broker: 'IBKR', account: 'U0000009', sourceFile: 'a.csv', type: 'DEPOSIT', currency: 'USD', netCash: 100 }]])))
    const answer = await desk.propose([{ op: 'import-workbook', input: { file: 'a3', gone: 'keep' } }])
    expect(answer.isError).toBe(true)
    expect(answer.text).toContain('USD')
    expect(answer.text).toContain(words.proposals.workbook.place)
  })
})

describe("IBKR's mailed report", () => {
  it('accepts the new records and keeps the rows it asks about waiting, with a warned line counting them', async () => {
    const desk = await investmentsDesk(used)
    await desk.propose([{ op: 'accept-mail-report', input: { asked: 'hold' } }])
    const card = desk.cards[0]!
    expect(card.groups[0]!.lines[0]!.warning).toContain('1 row the report asks about')
    await desk.accept()
    expect(bookOf(desk).mailReaders[0]!.leftOut).toEqual([])
  })

  it('stops asking about the rows left out, in the same write, and Undo asks again', async () => {
    const desk = await investmentsDesk(used)
    await desk.propose([{ op: 'accept-mail-report', input: { asked: 'leave-out' } }])
    const result = await desk.accept()
    expect(bookOf(desk).mailReaders[0]!.leftOut).toEqual(['asked-1'])
    if (result.kind === 'done') await result.undo!()
    expect(bookOf(desk).mailReaders[0]!.leftOut).toEqual([])
  })
})

describe('the mail reader', () => {
  it('changes only the fields named, and marks the senders, which say whose mail Kuna reads', async () => {
    const desk = await investmentsDesk(used)
    await desk.propose([{ op: 'set-mail-reader', input: { on: null, senders: 'flex@example.com, reports@example.com', subject: null, contents: null, since: null } }])
    const field = desk.cards[0]!.groups[0]!.lines[0]!.fields[0]!
    expect(field).toMatchObject({ name: mailWords.card.senders, warns: true })
    await desk.accept()
    const [reader] = bookOf(desk).mailReaders
    expect(reader!.senders).toEqual(['flex@example.com', 'reports@example.com'])
    expect(reader!.on).toBe(true)
  })

  it("refuses what the mail card would mark, in the card's words", async () => {
    const desk = await investmentsDesk(used)
    const answer = await desk.propose([{ op: 'set-mail-reader', input: { on: null, senders: '', subject: null, contents: null, since: 'soon' } }])
    expect(answer.text).toContain(`senders: ${mailWords.card.sendersHelp}`)
    expect(answer.text).toContain(`since: ${mailWords.card.sinceMissing}`)
  })

  it('switches the reader off, which needs no consent, and leaves switching it on to the person on Settings, General', async () => {
    const desk = await investmentsDesk(used)
    const on = await desk.propose([{ op: 'set-mail-reader', input: { on: 'yes', senders: null, subject: null, contents: null, since: null } }])
    expect(on.isError).toBe(true)
    expect(on.text).toContain('Settings, General')

    await desk.propose([{ op: 'set-mail-reader', input: { on: 'no', senders: null, subject: null, contents: null, since: null } }])
    const result = await desk.accept()
    expect(bookOf(desk).mailReaders[0]!.on).toBe(false)
    if (result.kind === 'done') await result.undo!()
    expect(bookOf(desk).mailReaders[0]!.on).toBe(true)
  })
})

describe('prices', () => {
  it('fetches now on a card with no Undo, saying what stays outside the books', async () => {
    const desk = await investmentsDesk(used)
    await desk.propose([{ op: 'fetch-prices', input: {} }])
    const card = desk.cards[0]!
    expect(card.undoable).toBe(false)
    expect(card.outside).toEqual([words.cards.vendorsOutside])
    expect(await desk.accept()).toEqual({ kind: 'done', undo: null })
    expect(desk.runs.asked).toEqual(['now'])
  })

  it('warns of the series a fetch got nothing for, as the Prices tab does', async () => {
    const desk = await investmentsDesk(used)
    desk.runs.answer = { kind: 'written', file: { ...emptyPricesFile(), failures: [{ series: 'twelvedata:SHARE', day: '2026-11-07', reason: 'unknown-symbol' }] } }
    await desk.propose([{ op: 'fetch-prices', input: {} }])
    const result = await desk.accept()
    expect(result).toMatchObject({ kind: 'done', undo: null })
    expect(result.kind === 'done' && result.warning).toContain(plural(pricesWords.failures.title(1), 1))
  })

  it("says why a run wrote nothing, in the Prices tab's words", async () => {
    const desk = await investmentsDesk(used)
    desk.runs.answer = { kind: 'refused', reason: 'not-prices' }
    await desk.propose([{ op: 'fetch-prices', input: {} }])
    expect(await desk.accept()).toEqual({ kind: 'refused', reason: pricesWords.refused['not-prices'] })
  })

  it('imports closes for the holding the file is named after, then fetches what follows', async () => {
    const desk = await investmentsDesk(used)
    await desk.propose([{ op: 'import-closes', input: { file: 'a2', instrument: null } }])
    const [line] = desk.cards[0]!.groups[0]!.lines
    expect(line!.label).toBe(DESK.SHARE.name)
    expect(line!.fields[0]!.after).toContain('2')
    await desk.accept()
    expect(desk.runs.asked).toEqual([`closes of ${DESK.SHARE.name}`])
    expect(desk.fetches.count).toBe(1)
  })

  it('refuses a file named after no holding, a holding priced by hand, and a page', async () => {
    const desk = await investmentsDesk(used)
    desk.attachments.push(closesAttachment('a3', 'NOPE.csv', 'Date,Close\n2026-10-01,1\n'), { ...desk.attachments[1]!, id: 'a4', kind: 'pdf' })
    expect((await desk.propose([{ op: 'import-closes', input: { file: 'a3', instrument: null } }])).text).toContain(pricesWords.closesImport.noMatch)
    expect((await desk.propose([{ op: 'import-closes', input: { file: 'a3', instrument: desk.ref('instrument', DESK.FUND.id) } }])).text).toContain('priced by hand')
    expect((await desk.propose([{ op: 'import-closes', input: { file: 'a4', instrument: null } }])).text).toBe(NOT_READ_OFF_A_PAGE)
  })

  it('asks again only for a holding whose page warns of a missing fact', async () => {
    const desk = await investmentsDesk(used)
    expect((await desk.propose([{ op: 'ask-facts-again', input: { instrument: desk.ref('instrument', DESK.FUND.id) } }])).text).toContain('nothing to ask again')
    await desk.propose([{ op: 'ask-facts-again', input: { instrument: desk.ref('instrument', DESK.SHARE.id) } }])
    await desk.accept()
    expect(desk.runs.asked).toEqual([`facts of ${DESK.SHARE.id}`])
  })
})
