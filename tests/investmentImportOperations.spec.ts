// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { words as mailWords } from '../src/apps/investments/mail/presentation/words'
import { words as pricesWords } from '../src/apps/investments/prices/presentation/words'
import { words } from '../src/apps/investments/assistant/words'
import { emptyPricesFile } from '../src/apps/investments/prices/domain/pricesFile'
import { INVESTMENTS_PRICES_ROUTE } from '../src/apps/investments/overview/presentation/investmentLinks'
import { plural } from '../src/shared/text/translation'
import { DESK, investmentsDesk } from './fixtures/investmentsDesk'
import type { InvestmentsDesk } from './fixtures/investmentsDesk'
import { forgetCaches } from './fixtures/writeBack'
import { stepOf } from './fixtures/operationSteps'
import { INVESTMENTS_OPERATIONS } from '../src/apps/investments/assistant/operations/investmentsOperations'

const used = new Set<string>()
afterEach(async () => forgetCaches(used))

const bookOf = ({ store }: InvestmentsDesk) => store.state.workbook!.book

describe("IBKR's mailed report", () => {
  it('accepts the new records and keeps the rows it asks about waiting, with a warned line counting them', async () => {
    const desk = await investmentsDesk(used)
    await desk.propose([stepOf(INVESTMENTS_OPERATIONS, 'accept-mail-report', { asked: 'hold' })])
    const card = desk.cards[0]!
    expect(card.groups[0]!.notes[0]!.text).toContain('1 row the report asks about')
    await desk.accept()
    expect(bookOf(desk).mailReaders[0]!.leftOut).toEqual([])
  })

  it('stops asking about the rows left out, in the same write, and Undo asks again', async () => {
    const desk = await investmentsDesk(used)
    await desk.propose([stepOf(INVESTMENTS_OPERATIONS, 'accept-mail-report', { asked: 'leave-out' })])
    const result = await desk.accept()
    expect(bookOf(desk).mailReaders[0]!.leftOut).toEqual(['asked-1'])
    if (result.kind === 'done') await result.undo!()
    expect(bookOf(desk).mailReaders[0]!.leftOut).toEqual([])
  })
})

describe('the mail reader', () => {
  it('changes only the fields named, and marks the senders, which say whose mail Kuna reads', async () => {
    const desk = await investmentsDesk(used)
    await desk.propose([stepOf(INVESTMENTS_OPERATIONS, 'set-mail-reader', { senders: 'flex@example.com, reports@example.com' })])
    const field = desk.cards[0]!.groups[0]!.lines[0]!.fields[0]!
    expect(field).toMatchObject({ name: mailWords.card.senders, warns: true })
    await desk.accept()
    const [reader] = bookOf(desk).mailReaders
    expect(reader!.senders).toEqual(['flex@example.com', 'reports@example.com'])
    expect(reader!.on).toBe(true)
  })

  it("refuses what the mail card would mark, in the card's words", async () => {
    const desk = await investmentsDesk(used)
    const answer = await desk.propose([stepOf(INVESTMENTS_OPERATIONS, 'set-mail-reader', { senders: '', subject: 'a "b' })])
    expect(answer.text).toContain(`senders: ${mailWords.card.sendersHelp}`)
    expect(answer.text).toContain('subject: ')
  })

  it('switches the reader off, which needs no consent, and leaves switching it on to the person on Settings, General', async () => {
    const desk = await investmentsDesk(used)
    const on = await desk.propose([stepOf(INVESTMENTS_OPERATIONS, 'set-mail-reader', { on: 'yes' })])
    expect(on.isError).toBe(true)
    expect(on.text).toContain('Settings, General')

    await desk.propose([stepOf(INVESTMENTS_OPERATIONS, 'set-mail-reader', { on: 'no' })])
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

  it('warns of the series a fetch got nothing for, as the Prices tab does, and links Settings, Prices', async () => {
    const desk = await investmentsDesk(used)
    desk.runs.answer = { kind: 'written', file: { ...emptyPricesFile(), failures: [{ series: 'twelvedata:SHARE', day: '2026-11-07', reason: 'unknown-symbol' }] } }
    await desk.propose([{ op: 'fetch-prices', input: {} }])
    const result = await desk.accept()
    expect(result).toMatchObject({ kind: 'done', undo: null })
    expect(result.kind === 'done' && result.warning?.text).toContain(plural(pricesWords.failures.title(1), 1))
    expect(result.kind === 'done' && result.warning?.link?.to).toBe(INVESTMENTS_PRICES_ROUTE)
  })

  it("says why a run wrote nothing, in the Prices tab's words", async () => {
    const desk = await investmentsDesk(used)
    desk.runs.answer = { kind: 'refused', reason: 'not-prices' }
    await desk.propose([{ op: 'fetch-prices', input: {} }])
    expect(await desk.accept()).toEqual({ kind: 'refused', reason: pricesWords.refused['not-prices'] })
  })

  it('asks again only for a holding whose page warns of a missing fact', async () => {
    const desk = await investmentsDesk(used)
    expect((await desk.propose([stepOf(INVESTMENTS_OPERATIONS, 'ask-facts-again', { instrument: desk.ref('instrument', DESK.FUND.id) })])).text).toContain('nothing to ask again')
    await desk.propose([stepOf(INVESTMENTS_OPERATIONS, 'ask-facts-again', { instrument: desk.ref('instrument', DESK.SHARE.id) })])
    await desk.accept()
    expect(desk.runs.asked).toEqual([`facts of ${DESK.SHARE.id}`])
  })
})
