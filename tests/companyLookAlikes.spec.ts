// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { dryRunFor, writeImport } from '../src/apps/company/imports/application/importStatements'
import { importDryRun } from '../src/apps/company/imports/domain/importDryRun'
import type { DryRunInputs } from '../src/apps/company/imports/domain/importDryRun'
import type { ImportedStatement } from '../src/apps/company/imports/domain/importedStatement'
import { transcribedStatement } from '../src/apps/company/imports/domain/importedStatement'
import { en } from '../src/apps/company/imports/domain/words'
import { paymentRowsOf } from '../src/apps/company/packs/hr-doo/domain/assets/assetRegister'
import { ITEM_RECORDS } from '../src/apps/company/workbook/domain/coreKinds'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { writeSplit } from '../src/apps/company/transactions/application/splitWrites'
import { storedSplitsOf } from '../src/apps/company/workbook/domain/storedSplits'
import type { Transaction } from '../src/apps/company/workbook/domain/workbook'
import { ACCOUNT_RECORDS, CATEGORY_RECORDS, LEDGER_RECORDS } from '../src/apps/company/workbook/domain/coreKinds'
import type { LookAlikes } from '../src/shared/money/lookAlikeBookings'
import { moneyFromAmount } from '../src/shared/money/money'
import { NO_SIGNALS, civil, euros, ledger } from './fixtures/ledger'
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

function inputsOf(transactions: readonly Transaction[], twinAnswers: DryRunInputs['twinAnswers'] = new Map()): DryRunInputs {
  return {
    transactions,
    rules: [],
    context: { ownIbans: new Set(), clientIbans: new Set(), cardSettlementIbans: new Set(), accountCurrencies: new Map(), defaultCurrency: 'EUR' },
    categories: [],
    starts: new Map(),
    named: new Map(),
    twinAnswers,
    repaymentsOf: () => [],
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
    expect(importDryRun([camt], inputsOf(CAMT_ROWS)).statements[0]!.refusal).toContain('before 8 Oct 2026')
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
      account: desk.ref(ACCOUNT_RECORDS.name, 'main'),
      statementName: 'Statement 8',
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

  it('matches a split row by its whole amount, since the parts sit beside the bank row and never replace it on the ledger', async () => {
    const desk = await companyDesk(used)
    const shop = desk.row('REF-9')
    await desk.propose([
      {
        op: 'split-row',
        input: {
          row: desk.ref(LEDGER_RECORDS.name, shop.id),
          by: 'amount',
          parts: [
            { part: null, amount: 30, category: desk.ref(CATEGORY_RECORDS.name, 'office'), note: '' },
            { part: null, amount: null, category: desk.ref(CATEGORY_RECORDS.name, 'travel'), note: '' },
          ],
        },
      },
    ])
    expect((await desk.accept()).kind).toBe('done')
    expect(desk.store.state.workbook!.splits.find((split) => split.row.id === shop.id)?.parts).toHaveLength(2)
    expect((await desk.propose([copiedStep(desk, [{ date: '2026-10-10', amount: -50, counterparty: 'New shop' }, KIOSK])])).isError).toBe(false)
    const notes = desk.cards.at(-1)!.groups.flatMap((group) => group.notes)
    expect(notes.map((note) => note.text)).toContain('1 entry is on the ledger already. 1 new entry follows it.')
    expect((await desk.accept()).kind).toBe('done')
    expect(desk.store.state.workbook!.transactions.filter((row) => row.account === 'main' && row.amount === -5000)).toHaveLength(1)
  })

  it('refuses a card of look-alikes alone, so the model asks first', async () => {
    const desk = await companyDesk(used)
    const answer = await desk.propose([copiedStep(desk, [SHOP_LATER])])
    expect(answer.isError).toBe(true)
    expect(answer.text).toContain('Row 1 looks like a row Kuna has from another source, with the same amount and at most 3 days apart, and nothing else is new.')
    expect(desk.cards).toEqual([])
  })
})

describe('a file over a row the AI copied, on the Import screen', () => {
  /** The desk with a kiosk payment of 2 November the chat copied, and the file's entry of 3 November that is that payment. */
  async function copiedKioskAndFile(): Promise<{ readonly desk: CompanyDesk; readonly copiedKiosk: Transaction; readonly statement: ImportedStatement }> {
    const desk = await companyDesk(used)
    const kiosk = { date: '2026-11-02', amount: -12.5, counterparty: 'Kiosk', iban: null, description: '' }
    const input = {
      file: null,
      account: desk.ref(ACCOUNT_RECORDS.name, 'main'),
      statementName: 'Statement 9',
      opening: 760,
      closing: 747.5,
      rows: [kiosk],
      lookAlikes: 'ask',
      newAccount: null,
      part: 1,
    }
    expect((await desk.propose([{ op: 'import-statement', input }])).isError).toBe(false)
    expect((await desk.accept()).kind).toBe('done')
    const copiedKiosk = desk.store.state.workbook!.transactions.find((row) => row.counterparty === 'Kiosk')!
    const entry = {
      date: civil('2026-11-03'),
      amount: moneyFromAmount(-12.5),
      balance: moneyFromAmount(747.5),
      counterparty: 'KIOSK D.O.O.',
      counterpartyIban: '',
      description: '',
      reference: 'CAMT-K',
      signals: NO_SIGNALS,
      reviewReasons: [],
    }
    const statement = {
      fileName: 'november.xml',
      source: { kind: 'camt' as const, iban: '', sequence: 9 },
      label: 'november.xml',
      account: 'main',
      opening: moneyFromAmount(760),
      closing: moneyFromAmount(747.5),
      rows: [entry],
      notes: [],
    }
    return { desk, copiedKiosk, statement }
  }

  /** The import with the person's answer that the file's entry takes the copied kiosk payment's place. */
  function replacingRun(desk: CompanyDesk, copiedKiosk: Transaction, statement: ImportedStatement) {
    return dryRunFor([{ statement }], desk.store.state.workbook!, new Map(), new Map(), new Map([['main CAMT-K', { booked: copiedKiosk.id, keep: 'file' as const }]]))
  }

  it("writes the file's entry in the copied row's place in one write, and one Undo puts the copied row back", async () => {
    const { desk, copiedKiosk, statement } = await copiedKioskAndFile()
    const asked = dryRunFor([{ statement }], desk.store.state.workbook!, new Map())
    expect(asked.statements[0]!.questions.map((question) => question.copied.id)).toEqual([copiedKiosk.id])
    const run = replacingRun(desk, copiedKiosk, statement)
    expect(run.removed).toHaveLength(1)
    const receipt = await desk.store.write('Imported', (unit) => writeImport(unit, run, desk.store.state.records!))
    const kioskRows = () => desk.store.state.workbook!.transactions.filter((row) => row.account === 'main' && row.amount === moneyFromAmount(-12.5)).map((row) => row.reference)
    expect(kioskRows()).toEqual(['CAMT-K'])
    await desk.store.undo(desk.store.state.writes.find((write) => write.receipt === receipt)!)
    expect(kioskRows()).toEqual([copiedKiosk.reference])
  })

  it("keeps the copied row's split, and the trip and asset linked to it, on the file's entry that takes its place", async () => {
    const { desk, copiedKiosk, statement } = await copiedKioskAndFile()
    const { rowId } = copiedKiosk
    expect(rowId).not.toBeNull()
    const stored = storedSplitsOf(desk.store.state.records!)(copiedKiosk)
    const drafts = [
      { amount: euros(-10), category: 'office', note: '', opened: null },
      { amount: euros(-2.5), category: 'travel', note: 'Snack', opened: null },
    ]
    await desk.store.write('Split', (unit) => writeSplit(unit, desk.store.state.records!, copiedKiosk, stored, drafts, desk.store.state.workbook!.categories))

    const run = replacingRun(desk, copiedKiosk, statement)
    await desk.store.write('Imported', (unit) => writeImport(unit, run, desk.store.state.records!))

    const { transactions, splits } = desk.store.state.workbook!
    const split = splits.find((candidate) => candidate.row.reference === 'CAMT-K')
    expect(split?.row.rowId).toBe(rowId)
    expect(split?.parts.map((part) => [part.amount, part.category, part.note])).toEqual([
      [euros(-10), 'office', ''],
      [euros(-2.5), 'travel', 'Snack'],
    ])
    expect(transactions.filter((row) => row.rowId === rowId).map((row) => row.reference)).toEqual(['CAMT-K'])
    expect(paymentRowsOf(recordIdOf(ITEM_RECORDS, rowId!), transactions).map((row) => row.reference)).toEqual(['CAMT-K'])
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
    expect(statement!.facts).toEqual(['1 entry is on the ledger already. 1 new entry follows it.'])
    expect(run.added.map((entry) => [entry.counterparty, entry.balance])).toEqual([['Harbour bistro', moneyFromAmount(920.5)]])
  })

  const OCTOBER = [
    ['2026-10-05', -27, 'Telecom d.d.'],
    ['2026-10-07', -12.5, 'OFFICE SUPPLIES ZAGREB'],
    ['2026-10-10', -40, 'Harbour bistro'],
  ] as const
  const OFFICE = 'main CAMT-1'
  const copiedOf = (reference: string): Transaction => COPIED.find((row) => row.reference === `read-${reference}`)!

  it('asks about the look-alike and holds it, even without a balance, until the person answers', () => {
    const [reading] = camtOf(OCTOBER)
    const unbalanced = { statement: { ...reading!.statement, rows: reading!.statement.rows.map((row) => ({ ...row, balance: null })) } }
    const [statement] = importDryRun([unbalanced], inputsOf(COPIED)).statements
    expect(statement!.questions).toEqual([{ key: OFFICE, row: unbalanced.statement.rows[1], copied: copiedOf('REF-3'), keep: null }])
    expect(statement!.rows.map((row) => row.inLedger)).toEqual([true, true, false])
  })

  it('takes the look-alike as new when the person keeps both, so the balances refuse what the bank booked once', () => {
    const run = importDryRun(camtOf(OCTOBER), inputsOf(COPIED, new Map([[OFFICE, { booked: copiedOf('REF-3').id, keep: 'both' as const }]])))
    expect(run.statements[0]!.rows.map((row) => row.inLedger)).toEqual([true, false, false])
    expect(run.statements[0]!.refusal).toContain('before 8 Oct 2026')
    expect(run.removed).toEqual([])
  })

  it("lets the file's entry take the copied row's place, keeping its category, share and row id, and adds what follows", () => {
    const office = { ...copiedOf('REF-3'), category: 'office', flaggedBy: 'rule', rowId: 'row-office' }
    const filed = COPIED.map((row) => (row.reference === office.reference ? office : row))
    const run = importDryRun(camtOf(OCTOBER), inputsOf(filed, new Map([[OFFICE, { booked: office.id, keep: 'file' as const }]])))
    const [statement] = run.statements
    expect(statement!.refusal).toBeNull()
    expect(statement!.rows.map((row) => [row.inLedger, row.replaces?.reference ?? null])).toEqual([
      [true, null],
      [false, 'read-REF-3'],
      [false, null],
    ])
    expect(run.removed).toEqual([office])
    expect(run.added.map((entry) => [entry.reference, entry.counterparty, entry.balance, entry.category])).toEqual([
      ['CAMT-2', 'Harbour bistro', moneyFromAmount(920.5), 'unknown'],
      ['CAMT-1', 'OFFICE SUPPLIES ZAGREB', moneyFromAmount(960.5), 'office'],
    ])
    expect(run.added[1]!.rowId).toBe('row-office')
    expect(run.added[0]!.rowId).not.toBeNull()
    expect(run.added[0]!.rowId).not.toBe('row-office')
    expect(statement!.facts).toContain("1 row the AI copied gives way to the file's entry, which keeps its category.")
  })

  it('gives the entry a new row id when the copied row it takes the place of has none, as rows of older books have none', () => {
    const run = importDryRun(camtOf(OCTOBER), inputsOf(COPIED, new Map([[OFFICE, { booked: copiedOf('REF-3').id, keep: 'file' as const }]])))
    expect(copiedOf('REF-3').rowId).toBeNull()
    expect(run.added.map((entry) => entry.rowId)).toEqual([expect.any(String), expect.any(String)])
  })

  it('replaces the copied rows after the answered one too, each by the entry it is or looks like', () => {
    const run = importDryRun(
      camtOf([['2026-10-04', -27, 'TELECOM D.D. ZAGREB'], ...OCTOBER.slice(1)]),
      inputsOf(COPIED, new Map([['main CAMT-0', { booked: copiedOf('REF-2').id, keep: 'file' as const }]])),
    )
    const [statement] = run.statements
    expect(statement!.refusal).toBeNull()
    expect(statement!.questions.map((question) => question.keep)).toEqual(['file', null])
    expect(run.removed).toEqual([copiedOf('REF-3'), copiedOf('REF-2')])
    expect(run.added.map((entry) => [entry.reference, entry.balance]).reverse()).toEqual([
      ['CAMT-0', moneyFromAmount(973)],
      ['CAMT-1', moneyFromAmount(960.5)],
      ['CAMT-2', moneyFromAmount(920.5)],
    ])
    expect(statement!.facts).toContain("2 rows the AI copied give way to the file's entries, which keep their categories.")
  })

  it('refuses to replace a copied row that a row of another statement follows', () => {
    const later = ledger([{ date: '2026-10-09', amount: -10, counterparty: 'Parking', description: '' }]).map((row) => ({
      ...row,
      reference: 'OTHER-1',
      balance: moneyFromAmount(950.5),
      sequence: 10,
    }))
    const run = importDryRun(camtOf(OCTOBER), inputsOf([...COPIED, ...later], new Map([[OFFICE, { booked: copiedOf('REF-3').id, keep: 'file' as const }]])))
    expect(run.statements[0]!.refusal).toContain('Parking of 9 Oct 2026 after it is not on this statement')
    expect(run.added).toEqual([])
    expect(run.removed).toEqual([])
  })

  it('keeps a near miss new, which the ledger refuses before its newest row', () => {
    const run = importDryRun(camtOf([['2026-10-05', -27.01, 'Telecom d.d.']]), inputsOf(COPIED))
    expect(run.statements[0]!.rows.map((row) => row.inLedger)).toEqual([false])
    expect(run.statements[0]!.refusal).toContain('before 8 Oct 2026')
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
