// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { importDryRun } from '../src/apps/company/imports/domain/importDryRun'
import type { DryRunInputs } from '../src/apps/company/imports/domain/importDryRun'
import { transcribedStatement } from '../src/apps/company/imports/domain/importedStatement'
import { en } from '../src/apps/company/imports/domain/words'
import type { Transaction } from '../src/apps/company/workbook/domain/workbook'
import { ACCOUNT_RECORDS } from '../src/apps/company/workbook/domain/coreKinds'
import type { LookAlikes } from '../src/shared/money/lookAlikeBookings'
import { moneyFromAmount } from '../src/shared/money/money'
import { NO_SIGNALS, civil, ledger } from './fixtures/ledger'
import { companyDesk } from './fixtures/companyDesk'
import type { CompanyDesk } from './fixtures/companyDesk'
import { forgetCaches } from './fixtures/writeBack'

const used = new Set<string>()
afterEach(async () => forgetCaches(used))

/** Rows a camt import filed on the main account, which leave it at 960.50 on 8 October. */
const CAMT_ROWS = ledger([
  { date: '2026-10-01', amount: 1000, counterparty: 'Northwind', description: 'Invoice 1' },
  { date: '2026-10-05', amount: -27, counterparty: 'Telecom d.d.', description: 'Phone' },
  { date: '2026-10-08', amount: -12.5, counterparty: 'Office supplies d.o.o.', description: 'Paper' },
])

function inputsOf(transactions: readonly Transaction[]): DryRunInputs {
  return {
    transactions,
    rules: [],
    context: { ownIbans: new Set(), clientIbans: new Set(), cardSettlementIbans: new Set(), accountCurrencies: new Map(), defaultCurrency: 'EUR' },
    categories: [],
    starts: new Map(),
    named: new Map(),
  }
}

/** A statement the AI copied onto the main account from an opening of 1000, each row given as its day, amount and counterparty. */
function copied(rows: readonly (readonly [string, number, string])[], lookAlikes: LookAlikes = 'ask') {
  const entries = rows.map(([date, amount, counterparty]) => ({ date: civil(date), amount: moneyFromAmount(amount), counterparty, counterpartyIban: '', description: '' }))
  const closing = rows.reduce((balance, [, amount]) => balance + amount, 1000)
  return [{ statement: transcribedStatement('main', 'main 2026-10-05/2026-10-10', moneyFromAmount(1000), moneyFromAmount(closing), entries, lookAlikes) }]
}

describe('a copied statement over a camt import', () => {
  it('counts the same row as on the ledger, holds the look-alike in its place and adds the rest after the ledger', () => {
    const run = importDryRun(
      copied([
        ['2026-10-05', -27, 'TELECOM D.D.'],
        ['2026-10-09', -12.5, 'Office supplies'],
        ['2026-10-10', -40, 'Harbour bistro'],
      ]),
      inputsOf(CAMT_ROWS),
    )
    const [statement] = run.statements
    expect(statement!.refusal).toBeNull()
    expect(statement!.rows.map((row) => [row.inLedger, row.like?.reference ?? null])).toEqual([
      [true, null],
      [false, 'REF-3'],
      [false, null],
    ])
    expect(run.added.map((entry) => [entry.counterparty, entry.balance])).toEqual([['Harbour bistro', moneyFromAmount(920.5)]])
  })

  it('takes the look-alike as a new row once the person says so, and the balances still refuse it when it was the same', () => {
    const run = importDryRun(
      copied(
        [
          ['2026-10-05', -27, 'Telecom d.d.'],
          ['2026-10-09', -12.5, 'Office supplies'],
        ],
        'import',
      ),
      inputsOf(CAMT_ROWS),
    )
    expect(run.statements[0]!.refusal).toContain('a statement between the two is missing')
    expect(run.added).toEqual([])
  })

  it.each([
    ['a cent off', ['2026-10-08', -12.51, 'Office supplies'] as const],
    ['another counterparty', ['2026-10-08', -12.5, 'Bookshop'] as const],
  ])('keeps a row %s new, so it must run on from where the ledger leaves the account', (_, near) => {
    const run = importDryRun(copied([['2026-10-05', -27, 'Telecom d.d.'], near]), inputsOf(CAMT_ROWS))
    expect(run.statements[0]!.rows.map((row) => row.inLedger || row.like !== undefined)).toEqual([true, false])
    expect(run.statements[0]!.refusal).toContain('a statement between the two is missing')
  })

  it('leaves a statement Kuna read itself matching by reference alone', () => {
    const [reading] = copied([['2026-10-05', -27, 'Telecom d.d.']])
    const camt = { statement: { ...reading!.statement, source: { kind: 'camt' as const, iban: '', sequence: 2 } } }
    expect(importDryRun([camt], inputsOf(CAMT_ROWS)).statements[0]!.refusal).toContain('before 2026-10-08')
  })
})

describe('a copied statement over typed ledger rows', () => {
  it('counts a typed row of the same day, amount and counterparty as on the ledger', () => {
    const typed = CAMT_ROWS.map((row) => ({ ...row, reference: '', statement: '' }))
    const run = importDryRun(
      copied([
        ['2026-10-05', -27, 'Telecom d.d.'],
        ['2026-10-08', -12.5, 'Office supplies d.o.o.'],
        ['2026-10-10', -40, 'Harbour bistro'],
      ]),
      inputsOf(typed),
    )
    expect(run.statements[0]!.rows.map((row) => row.inLedger)).toEqual([true, true, false])
    expect(run.newRows).toBe(1)
  })
})

describe('copied rows on a card that look like ledger rows', () => {
  /** Rows copied onto the main account from an opening of 810, the balance before NEW SHOP's 50.00 on 10 October. */
  const copiedStep = (desk: CompanyDesk, rows: readonly { readonly date: string; readonly amount: number; readonly counterparty: string }[], lookAlikes = 'ask') => ({
    op: 'import-statement',
    input: {
      file: null,
      profile: null,
      account: desk.ref(ACCOUNT_RECORDS.name, 'main'),
      opening: 810,
      closing: rows.reduce((balance, row) => balance + row.amount, 810),
      rows: rows.map((row) => ({ ...row, iban: null, description: '' })),
      lookAlikes,
      newAccount: null,
      part: 1,
    },
  })
  const SHOP_LATER = { date: '2026-10-11', amount: -50, counterparty: 'New shop Zagreb' }
  const KIOSK = { date: '2026-11-02', amount: -12.5, counterparty: 'Kiosk' }

  it('holds a look-alike, lists it on the card beside the ledger row, and tells the model to ask', async () => {
    const desk = await companyDesk(used)
    const answer = await desk.propose([copiedStep(desk, [SHOP_LATER, KIOSK])])
    expect(answer.isError).toBe(false)
    expect(answer.text).toContain(
      'Row 1 looks like a row Kuna has from another source, with the same amount and at most 3 days apart, and waits. Ask the person whether each is another payment, and if so propose the same rows again with lookAlikes import once this card is answered.',
    )
    const notes = desk.cards[0]!.groups.flatMap((group) => group.notes)
    expect(notes.map((note) => note.tone)).toEqual(['info', 'warning'])
    expect(notes[1]).toMatchObject({ text: 'The AI read 2 rows from the chat. Check them against the statement.', tone: 'warning' })
    expect(notes[0]).toEqual({
      label: '1 row waits, not imported',
      text: 'It looks like a row Kuna has from another source, with the same amount and at most 3 days apart. Say in the chat whether it is another payment.',
      tone: 'info',
      items: [{ row: expect.stringMatching(/^New shop Zagreb, .*50.*, .*11/), record: expect.stringMatching(/^NEW SHOP, .*50.*, .*10/) }],
    })
    expect((await desk.accept()).kind).toBe('done')
    expect(desk.store.state.workbook!.transactions.filter((row) => row.account === 'main' && row.amount === -5000)).toHaveLength(1)
  })

  it('asks about the look-alike first, warns next, and states the entries on the ledger as a plain fact last', async () => {
    const desk = await companyDesk(used)
    const step = copiedStep(desk, [{ date: '2026-10-09', amount: -30, counterparty: 'MARKET ONE' }, SHOP_LATER, KIOSK])
    expect((await desk.propose([{ ...step, input: { ...step.input, opening: 840, closing: 840 - 30 - 50 - 12.5 } }])).isError).toBe(false)
    const notes = desk.cards[0]!.groups.flatMap((group) => group.notes)
    expect(notes.map((note) => [note.tone, note.text])).toEqual([
      ['info', expect.any(String)],
      ['warning', 'The AI read 3 rows from the chat. Check them against the statement.'],
      ['neutral', '1 entry is on the ledger already. 1 new entry follows it.'],
    ])
  })

  it('refuses a card of look-alikes alone, so the model asks first', async () => {
    const desk = await companyDesk(used)
    const answer = await desk.propose([copiedStep(desk, [SHOP_LATER])])
    expect(answer.isError).toBe(true)
    expect(answer.text).toContain('Row 1 looks like a row Kuna has from another source, with the same amount and at most 3 days apart, and nothing else is new.')
    expect(desk.cards).toEqual([])
  })
})

describe('a camt statement over rows the AI copied', () => {
  /** The camt rows of 5 and 8 October as the AI copied them earlier, so the ledger ends at 960.50. */
  const COPIED = CAMT_ROWS.map((row) => ({ ...row, reference: `read-${row.reference}`, statement: 'main 2026-10-01/2026-10-08' }))

  /** A camt statement of the main account from an opening of 1000, with the balance after each entry. */
  function camtOf(rows: readonly (readonly [string, number, string])[]) {
    let balance = 1000
    const entries = rows.map(([date, amount, counterparty], at) => {
      balance += amount
      return {
        date: civil(date),
        amount: moneyFromAmount(amount),
        balance: moneyFromAmount(balance),
        counterparty,
        counterpartyIban: '',
        description: '',
        reference: `CAMT-${at}`,
        signals: NO_SIGNALS,
        reviewReasons: [],
      }
    })
    const statement = {
      fileName: 'october.xml',
      source: { kind: 'camt' as const, iban: '', sequence: 7 },
      label: 'october.xml',
      account: 'main',
      opening: moneyFromAmount(1000),
      closing: moneyFromAmount(balance),
      rows: entries,
      notes: [],
    }
    return [{ statement }]
  }

  it('counts the same row and a look-alike with its balance as on the ledger, and adds what follows', () => {
    const run = importDryRun(
      camtOf([
        ['2026-10-05', -27, 'Telecom d.d.'],
        ['2026-10-07', -12.5, 'OFFICE SUPPLIES ZAGREB'],
        ['2026-10-10', -40, 'Harbour bistro'],
      ]),
      inputsOf(COPIED),
    )
    const [statement] = run.statements
    expect(statement!.refusal).toBeNull()
    expect(statement!.rows.map((row) => row.inLedger)).toEqual([true, true, false])
    expect(statement!.rows[1]!.copiedTwin).toMatchObject({ counterparty: 'Office supplies d.o.o.', amount: moneyFromAmount(-12.5) })
    expect(statement!.notes).toEqual([])
    expect(statement!.facts).toEqual([
      '1 entry looks like a row the AI copied, with the same amount and at most 3 days apart, so it counts as on the ledger. The balances after it check that.',
      '1 entry is on the ledger already. 1 new entry follows it.',
    ])
    expect(run.added.map((entry) => [entry.counterparty, entry.balance])).toEqual([['Harbour bistro', moneyFromAmount(920.5)]])
  })

  it('keeps a near miss new, which the ledger refuses before its newest row', () => {
    const run = importDryRun(camtOf([['2026-10-05', -27.01, 'Telecom d.d.']]), inputsOf(COPIED))
    expect(run.statements[0]!.rows.map((row) => row.inLedger)).toEqual([false])
    expect(run.statements[0]!.refusal).toContain('before 2026-10-08')
  })

  it('counts only the entries on the ledger in the fact on a copied statement that is partly there, as the card lists the look-alikes', () => {
    const run = importDryRun(
      copied([
        ['2026-10-05', -27, 'Telecom d.d.'],
        ['2026-10-09', -12.5, 'Office supplies'],
        ['2026-10-10', -40, 'Harbour bistro'],
      ]),
      inputsOf(CAMT_ROWS),
    )
    expect(run.statements[0]!.facts).toContain('1 entry is on the ledger already. 1 new entry follows it.')
  })

  it('agrees the note on a partly held statement with each count', () => {
    expect(en.dryRun.partlyHeld(1, 2)).toBe('1 entry is on the ledger already. 2 new entries follow it.')
    expect(en.dryRun.partlyHeld(2, 1)).toBe('2 entries are on the ledger already. 1 new entry follows them.')
    expect(en.dryRun.partlyHeld(3, 4)).toBe('3 entries are on the ledger already. 4 new entries follow them.')
  })
})
