import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'

import { ROWS_A_PART } from '../src/shared/app/proposedWrites'
import type { Transaction } from '../src/apps/spending/workbook/domain/transaction'
import type { ChatAttachment } from '../src/shared/ai/domain/chatAttachments'
import { accountMoneyFromCents } from '../src/shared/money/accountMoney'
import type { RuledChange } from '../src/shared/storage/application/recordWrites'
import { amountText } from '../src/shared/storage/domain/recordFields'
import { DESK_ACCOUNTS, spendingDesk } from './fixtures/spendingDesk'
import type { SpendingDesk } from './fixtures/spendingDesk'
import { forgetCaches } from './fixtures/writeBack'
import { stepOf } from './fixtures/operationSteps'
import { SPENDING_OPERATIONS } from '../src/apps/spending/assistant/operations/spendingOperations'

const used = new Set<string>()
afterEach(async () => forgetCaches(used))

const DOCUMENTS = new URL('./fixtures/documents/', import.meta.url)

interface PrintedRow {
  readonly date: string
  readonly payee: string
  readonly cents: number
}

interface Printed {
  readonly file: string
  readonly opening: number
  readonly closing: number
  readonly rows: readonly PrintedRow[]
}

const STATEMENTS = JSON.parse(readFileSync(new URL('statements.json', DOCUMENTS), 'utf8')) as readonly Printed[]

/** A figure as a model writes it from the page, such as -42.15. */
function amountOf(cents: number): number {
  return Number(amountText(accountMoneyFromCents(cents)))
}

/** The statement as a model transcribes it from the page, onto the current account. */
function transcribed(desk: SpendingDesk, file: string, fields: Record<string, unknown> = {}) {
  const printed = STATEMENTS.find((statement) => statement.file === file)!
  return {
    op: 'import-statement',
    input: {
      file: null,
      account: desk.ref('account', DESK_ACCOUNTS.CURRENT.id),
      statementName: 'Statement 9',
      opening: amountOf(printed.opening),
      closing: amountOf(printed.closing),
      rows: printed.rows.map((row) => ({ date: row.date, amount: amountOf(row.cents), payee: row.payee, iban: null })),
      part: 1,
      lookAlikes: 'ask',
      fromDay: null,
      toDay: null,
      ...fields,
    },
  }
}

function attached(kind: ChatAttachment['kind'], file: string, bytes = new Uint8Array(readFileSync(new URL(file, DOCUMENTS)))): ChatAttachment {
  return {
    id: 'a1',
    kind,
    name: file,
    bytes,
    original: new Blob([bytes]),
    pages: 1,
    sent: null,
    reading: { kind: 'cells', sheets: [], characters: bytes.length, reads: 1 },
  }
}

/** A Revolut export as CSV, its rows under Revolut's header. */
function revolutCsv(rows: readonly string[]): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(['Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance', ...rows].join('\n'))
}

/** The warned lines of the last card. */
function warnings(desk: SpendingDesk): readonly string[] {
  return desk.cards
    .at(-1)!
    .groups.flatMap((group) => group.notes)
    .map((note) => note.text)
}

const rowsOn = (desk: SpendingDesk, account: string) => desk.store.state.workbook!.transactions.filter((row) => row.account === account)

describe('a statement read off a page', () => {
  it('imports rows that lead from the opening to the closing balance, in one write with one Undo', async () => {
    const desk = await spendingDesk(used)
    const before = rowsOn(desk, DESK_ACCOUNTS.CURRENT.id).length
    const answer = await desk.propose([transcribed(desk, 'statement-ties.pdf')])
    expect(answer.isError).toBe(false)
    const result = await desk.accept()
    expect(result.kind).toBe('done')
    expect(rowsOn(desk, DESK_ACCOUNTS.CURRENT.id).length).toBe(before + 6)
    if (result.kind === 'done') expect((await result.undo!()).kind).toBe('undone')
    expect(rowsOn(desk, DESK_ACCOUNTS.CURRENT.id).length).toBe(before)
  })

  it('refuses a statement that does not add up, and names the gap', async () => {
    const desk = await spendingDesk(used)
    const answer = await desk.propose([transcribed(desk, 'statement-not-tying.pdf')])
    expect(answer.isError).toBe(true)
    expect(answer.text).toMatch(/0[.,]01/)
    expect(desk.cards).toEqual([])
  })

  it('refuses the closing balance without the opening, and the opening alone on a part after the first', async () => {
    const desk = await spendingDesk(used)
    for (const missing of [{ opening: null }, { closing: null, part: 2 }]) {
      const answer = await desk.propose([transcribed(desk, 'statement-ties.pdf', missing)])
      expect(answer.isError).toBe(true)
      expect(answer.text).toContain('or neither')
    }
    expect(desk.cards).toEqual([])
  })

  it('imports rows without printed balances, and warns that Kuna could not check them', async () => {
    const desk = await spendingDesk(used)
    const answer = await desk.propose([transcribed(desk, 'statement-ties.pdf', { opening: null, closing: null })])
    expect(answer.isError).toBe(false)
    expect(warnings(desk)).toEqual(['The AI read 6 rows from the chat. Kuna could not check that the statement adds up, so check them against it.'])
    expect((await desk.accept()).kind).toBe('done')
  })

  it('tells to check rows whose printed balances tie against the statement', async () => {
    const desk = await spendingDesk(used)
    await desk.propose([transcribed(desk, 'statement-ties.pdf')])
    expect(warnings(desk)).toEqual(['The AI read 6 rows from the chat. Check them against the statement.'])
  })

  it('imports nothing the second time, however the payees were spelled', async () => {
    const desk = await spendingDesk(used)
    await desk.propose([transcribed(desk, 'statement-ties.pdf')])
    await desk.accept()
    const again = transcribed(desk, 'statement-ties.pdf')
    const respelled = { ...again, input: { ...again.input, rows: again.input.rows.map((row) => ({ ...row, payee: row.payee.toUpperCase() })) } }
    const answer = await desk.propose([respelled])
    expect(answer.isError).toBe(true)
    expect(answer.text).toContain('Nothing would change')
  })

  it('files its new rows by a rule on the same card', async () => {
    const desk = await spendingDesk(used)
    const restaurants = desk.store.state.workbook!.categories.find((category) => category.name === 'Restaurants')!
    await desk.propose([transcribed(desk, 'statement-ties.pdf'), stepOf(SPENDING_OPERATIONS, 'add-rule', { fragment: 'Harbour', category: desk.ref('category', restaurants.id) })])
    expect((await desk.accept()).kind).toBe('done')
    expect(rowsOn(desk, DESK_ACCOUNTS.CURRENT.id).find((row) => row.payee === 'Harbour bistro')).toMatchObject({ category: restaurants.id, categorisedBy: 'rule' })
  })

  it('refuses a new category on the import’s card, which goes on a card before it', async () => {
    const desk = await spendingDesk(used)
    const answer = await desk.propose([stepOf(SPENDING_OPERATIONS, 'add-category', { name: 'Pets', kind: 'spending' }, '$pets'), transcribed(desk, 'statement-ties.pdf')])
    expect(answer.isError).toBe(true)
    expect(answer.text).toContain('Propose add-category on a card of its own first, and the import on the next card')
    expect(desk.cards).toEqual([])
  })

  it('warns on the card how many of the statement’s rows it leaves out', async () => {
    const desk = await spendingDesk(used)
    const step = transcribed(desk, 'statement-ties.pdf')
    const early = { date: '2025-12-31', amount: -3, payee: 'Before the account', iban: null }
    const answer = await desk.propose([{ ...step, input: { ...step.input, closing: step.input.closing - 3, rows: [early, ...step.input.rows] } }])
    expect(desk.cards[0]!.groups.flatMap((group) => group.notes)).toEqual([
      { label: expect.any(String), text: 'The AI read 7 rows from the chat. Check them against the statement. 1 row of the statement is left out.', tone: 'warning' },
    ])
    expect(answer.text).toContain('1 row of the statement is left out, as it falls before the account opened')
  })

  it('writes a row once that a rule on the card files and the import pairs, and one Undo puts it back', async () => {
    const desk = await spendingDesk(used)
    const savings = desk.ref('account', DESK_ACCOUNTS.SAVINGS.id)
    const topUp = { date: '2026-10-30', amount: 80, payee: 'Top-up', iban: DESK_ACCOUNTS.CURRENT.iban }
    await desk.propose([stepOf(SPENDING_OPERATIONS, 'import-statement', { account: savings, statementName: 'Statement 3', opening: 300, closing: 380, rows: [topUp], lookAlikes: 'ask', part: 1 })])
    await desk.accept()
    const waiting = rowsOn(desk, DESK_ACCOUNTS.SAVINGS.id).find((row) => row.payee === 'Top-up')!
    expect(waiting).toMatchObject({ category: null, pair: null })

    const rent = desk.store.state.workbook!.categories.find((category) => category.name === 'Rent')!
    const rule = stepOf(SPENDING_OPERATIONS, 'add-rule', { fragment: 'Top-up', category: desk.ref('category', rent.id) })
    const changesOn = (row: Transaction) => {
      const { changes } = desk.cards.at(-1)!.held as { readonly changes: readonly RuledChange[] }
      return changes.filter(({ change }) => change.verb === 'change' && (change.before as Transaction).id === row.id).map(({ change }) => change)
    }
    await desk.propose([rule])
    expect(changesOn(waiting)).toMatchObject([{ after: { category: rent.id, categorisedBy: 'rule' } }])

    const answer = await desk.propose([
      rule,
      stepOf(SPENDING_OPERATIONS, 'import-statement', {
        account: desk.ref('account', DESK_ACCOUNTS.CURRENT.id),
        statementName: 'Statement 10',
        opening: 500,
        closing: 420,
        rows: [{ ...topUp, amount: -80, iban: null }],
        lookAlikes: 'ask',
        part: 1,
      }),
    ])
    expect(answer.isError).toBe(false)
    expect(changesOn(waiting)).toHaveLength(1)
    const result = await desk.accept()
    expect(result.kind).toBe('done')
    const transfer = desk.store.state.workbook!.categories.find((category) => category.kind === 'transfer')!
    expect(rowsOn(desk, DESK_ACCOUNTS.SAVINGS.id).find((row) => row.id === waiting.id)).toMatchObject({ category: transfer.id })
    expect(rowsOn(desk, DESK_ACCOUNTS.SAVINGS.id).find((row) => row.id === waiting.id)!.pair).not.toBeNull()
    if (result.kind === 'done') expect((await result.undo!()).kind).toBe('undone')
    expect(rowsOn(desk, DESK_ACCOUNTS.SAVINGS.id).find((row) => row.id === waiting.id)).toEqual(waiting)
  })

  it('takes one statement to a card', async () => {
    const desk = await spendingDesk(used)
    expect((await desk.propose([transcribed(desk, 'statement-ties.pdf'), transcribed(desk, 'statement-ties.pdf')])).isError).toBe(true)
  })
})

describe('copied rows that look like rows from another source', () => {
  const copiedRows = (desk: SpendingDesk, rows: readonly { readonly date: string; readonly amount: number; readonly payee: string }[], lookAlikes = 'ask') =>
    stepOf(SPENDING_OPERATIONS, 'import-statement', {
      account: desk.ref('account', DESK_ACCOUNTS.CURRENT.id),
      statementName: 'Statement 11',
      rows,
      part: 1,
      lookAlikes,
    })
  const BAKERY_LATER = { date: '2026-10-16', amount: -20, payee: 'Bakery d.o.o.' }
  const KIOSK = { date: '2026-11-02', amount: -9, payee: 'Kiosk' }

  it('holds a look-alike, lists it on the card beside the row it looks like, and tells the model to ask', async () => {
    const desk = await spendingDesk(used)
    const before = rowsOn(desk, DESK_ACCOUNTS.CURRENT.id).length
    const answer = await desk.propose([copiedRows(desk, [BAKERY_LATER, KIOSK])])
    expect(answer.isError).toBe(false)
    expect(answer.text).toContain(
      'Row 1 looks like a row Kuna has from another source, with the same amount and at most 3 days apart, and waits. Ask the person whether each is another payment, and if so propose the same rows again with lookAlikes import once this card is answered.',
    )
    const notes = desk.cards[0]!.groups.flatMap((group) => group.notes)
    expect(notes[0]).toEqual({
      label: '1 row waits, not imported',
      text: 'It looks like a row Kuna has from another source, with the same amount and at most 3 days apart. Say in the chat whether it is another payment.',
      tone: 'info',
      items: [{ row: expect.stringMatching(/^Bakery d\.o\.o\., .*20.*, .*16/), record: expect.stringMatching(/^Bakery, .*20.*, .*14/) }],
    })
    expect((await desk.accept()).kind).toBe('done')
    expect(rowsOn(desk, DESK_ACCOUNTS.CURRENT.id).length).toBe(before + 1)

    expect((await desk.propose([copiedRows(desk, [BAKERY_LATER, KIOSK], 'import')])).isError).toBe(false)
    expect((await desk.accept()).kind).toBe('done')
    expect(rowsOn(desk, DESK_ACCOUNTS.CURRENT.id).filter((row) => row.amount === -2000)).toHaveLength(2)
  })

  it('refuses a card of look-alikes alone, so the model asks first', async () => {
    const desk = await spendingDesk(used)
    const answer = await desk.propose([copiedRows(desk, [BAKERY_LATER])])
    expect(answer.isError).toBe(true)
    expect(answer.text).toContain('Row 1 looks like a row Kuna has from another source, with the same amount and at most 3 days apart, and nothing else is new.')
    expect(desk.cards).toEqual([])
  })

  it('skips a row of the same day, amount and payee, and says so on the card', async () => {
    const desk = await spendingDesk(used)
    const before = rowsOn(desk, DESK_ACCOUNTS.CURRENT.id).length
    const answer = await desk.propose([copiedRows(desk, [{ date: '2026-10-14', amount: -20, payee: 'BAKERY' }, KIOSK])])
    expect(answer.isError).toBe(false)
    expect(answer.text).not.toContain('lookAlikes import')
    expect(desk.cards.at(-1)!.groups.flatMap((group) => group.notes)).toEqual([
      { label: expect.any(String), text: 'The AI read 2 rows from the chat. Kuna could not check that the statement adds up, so check them against it.', tone: 'warning' },
      { label: expect.any(String), text: '1 row is in Kuna already and is skipped.', tone: 'neutral' },
    ])
    expect((await desk.accept()).kind).toBe('done')
    expect(rowsOn(desk, DESK_ACCOUNTS.CURRENT.id).length).toBe(before + 1)
  })
  it('brings only the days the card names, and warns on the rows it leaves out', async () => {
    const desk = await spendingDesk(used)
    const before = rowsOn(desk, DESK_ACCOUNTS.CURRENT.id).length
    const step = copiedRows(desk, [BAKERY_LATER, KIOSK])
    const answer = await desk.propose([{ ...step, input: { ...step.input, fromDay: '2026-10-20', toDay: null } }])
    expect(answer.isError).toBe(false)
    expect(answer.text).toContain('1 row of the statement is left out, as it falls before the account opened, outside the days the card names or on a day the bank sync covers.')
    expect((await desk.accept()).kind).toBe('done')
    expect(rowsOn(desk, DESK_ACCOUNTS.CURRENT.id).length).toBe(before + 1)
  })

  it('refuses a last day before the first', async () => {
    const desk = await spendingDesk(used)
    const step = copiedRows(desk, [KIOSK])
    const answer = await desk.propose([{ ...step, input: { ...step.input, fromDay: '2026-11-05', toDay: '2026-11-01' } }])
    expect(answer.isError).toBe(true)
    expect(answer.text).toContain('toDay 2026-11-01 comes before fromDay 2026-11-05.')
  })
})

describe('a statement in parts', () => {
  /** Three rows on each of three days from the first, made up and of amounts no typed row has. */
  const partRows = (firstDay: number) =>
    [0, 1, 2].map((offset) => ({ date: `2026-10-${String(firstDay + offset).padStart(2, '0')}`, amount: -(firstDay + offset + 0.11), payee: `Stall ${firstDay + offset}`, iban: null }))
  const PARTS = [partRows(1), partRows(4), partRows(7)]
  // The opening of 500.00 less the nine rows of 1.11 to 9.11, which add up to 45.99, leaves 454.01.
  const CLOSING = 454.01
  const part = (desk: SpendingDesk, number: number, fields: Record<string, unknown> = {}) => ({
    op: 'import-statement',
    input: {
      file: null,
      account: desk.ref('account', DESK_ACCOUNTS.CURRENT.id),
      statementName: 'October 2026',
      opening: null,
      closing: null,
      rows: PARTS[number - 1],
      part: number,
      lookAlikes: 'ask',
      fromDay: null,
      toDay: null,
      ...fields,
    },
  })

  it('carries only its own rows on each card, and ties on the last part against the rows the earlier parts put in Kuna', async () => {
    const desk = await spendingDesk(used)
    const before = rowsOn(desk, DESK_ACCOUNTS.CURRENT.id).length
    for (const step of [part(desk, 1, { opening: 500 }), part(desk, 2)]) {
      const answer = await desk.propose([step])
      expect(answer.isError, answer.text).toBe(false)
      expect(warnings(desk)).toEqual(['The AI read 3 rows from the chat. Kuna checks that the statement adds up once its last part gives the closing balance.'])
      expect((await desk.accept()).kind).toBe('done')
    }
    const last = await desk.propose([part(desk, 3, { opening: 500, closing: CLOSING })])
    expect(last.isError, last.text).toBe(false)
    expect(warnings(desk)).toEqual(['The AI read 3 rows from the chat. Check them against the statement.'])
    expect((await desk.accept()).kind).toBe('done')
    expect(rowsOn(desk, DESK_ACCOUNTS.CURRENT.id)).toHaveLength(before + 9)
    expect(rowsOn(desk, DESK_ACCOUNTS.CURRENT.id).filter((row) => row.statement === `${DESK_ACCOUNTS.CURRENT.name}, October 2026`)).toHaveLength(9)
  })

  it('refuses a last part that does not add up with the earlier parts, and names the gap', async () => {
    const desk = await spendingDesk(used)
    for (const step of [part(desk, 1, { opening: 500 }), part(desk, 2)]) {
      await desk.propose([step])
      await desk.accept()
    }
    const answer = await desk.propose([part(desk, 3, { opening: 500, closing: CLOSING + 0.01 })])
    expect(answer.isError).toBe(true)
    expect(answer.text).toMatch(/0[.,]01/)
    expect(answer.text).toContain('a row of an earlier part that Kuna had already from another source counts as missing')
  })

  it('refuses a part whose earlier parts are not in Kuna, and one that starts on a day they reach', async () => {
    const desk = await spendingDesk(used)
    const early = await desk.propose([part(desk, 2)])
    expect(early.isError).toBe(true)
    expect(early.text).toContain('from part 1')
    await desk.propose([part(desk, 1, { opening: 500 })])
    await desk.accept()
    const overlapping = await desk.propose([part(desk, 2, { rows: [...PARTS[0]!.slice(2).map((row) => ({ ...row, amount: -0.5 })), ...PARTS[1]!] })])
    expect(overlapping.isError).toBe(true)
    expect(overlapping.text).toContain('A part starts on the day after the one before it ends.')
  })

  it(`refuses a card of more than ${ROWS_A_PART} copied rows`, async () => {
    const desk = await spendingDesk(used)
    const rows = Array.from({ length: ROWS_A_PART + 1 }, (_, at) => ({ date: '2026-10-15', amount: -1, payee: `Shop ${at}`, iban: null }))
    const answer = await desk.propose([part(desk, 1, { rows })])
    expect(answer.isError).toBe(true)
    expect(answer.text).toContain(`at most ${ROWS_A_PART} copied rows`)
  })
})

describe('an attached statement file', () => {
  const ATTACHED = stepOf(SPENDING_OPERATIONS, 'import-statement', { file: 'a1', rows: [], lookAlikes: 'ask', part: 1 })

  it('sends the AI to read and copy any attached file it gave no rows of, a Revolut export included, and refuses a file not attached', async () => {
    const desk = await spendingDesk(used)
    for (const file of [attached('sheet', 'revolut.xlsx'), attached('csv', 'export.csv', revolutCsv([])), attached('xml', 'camt.xml')]) {
      const answer = await desk.propose([ATTACHED], [file])
      expect(answer.isError).toBe(true)
      expect(answer.text).toContain('read_attachment')
    }
    expect((await desk.propose([ATTACHED], [])).isError).toBe(true)
    expect(desk.cards).toEqual([])
  })

  it('imports rows the AI copied from a file of cells, and names the file on the card', async () => {
    const desk = await spendingDesk(used)
    const step = transcribed(desk, 'statement-ties.pdf', { file: 'a1', opening: null, closing: null })
    const answer = await desk.propose([step], [attached('csv', 'bank-export.csv', new TextEncoder().encode('Date;Amount\n'))])
    expect(answer.isError).toBe(false)
    expect(warnings(desk)).toEqual(['The AI read 6 rows from bank-export.csv. Kuna could not check that the statement adds up, so check them against it.'])
  })

  it('imports rows the AI copied off a Revolut export as off any other file, with the export unread by Kuna', async () => {
    const desk = await spendingDesk(used)
    const file = attached('csv', 'account-statement.csv', revolutCsv(['CARD_PAYMENT,Current,2026-10-02 10:00:00,2026-10-02 10:01:00,Shop,-5.00,0.00,EUR,COMPLETED,95.00']))
    const rows = [{ date: '2026-10-02', amount: -5, payee: 'Shop', iban: null }]
    const step = { op: 'import-statement', input: { ...ATTACHED.input, account: desk.ref('account', DESK_ACCOUNTS.CURRENT.id), statementName: 'October 2026', rows } }
    expect((await desk.propose([step], [file])).isError).toBe(false)
    expect(desk.cards[0]!.count).toBe(1)
    expect(warnings(desk)).toEqual(['The AI read 1 row from account-statement.csv. Kuna could not check that the statement adds up, so check it against it.'])
  })

  it('imports rows the AI copied off an attached PDF by its id', async () => {
    const desk = await spendingDesk(used)
    const pdf = { ...attached('pdf', 'statement-ties.pdf'), reading: { kind: 'whole' } as const }
    expect((await desk.propose([transcribed(desk, 'statement-ties.pdf', { file: 'a1' })], [pdf])).isError).toBe(false)
    expect(warnings(desk)).toEqual(['The AI read 6 rows from statement-ties.pdf. Check them against the statement.'])
  })
})
