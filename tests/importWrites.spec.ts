// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import type { DocumentCopy } from '../src/features/workbook/infrastructure/documentRecordStorage'
import { LEDGER_WRITES } from '../src/features/imports/application/ledgerWrites'
import { dryRunFor, statementReadings } from '../src/features/imports/application/importStatements'
import type { ImportDryRun } from '../src/features/imports/domain/importDryRun'
import type { ImportProfile } from '../src/features/imports/domain/importProfile'
import type { WorkbookStore } from '../src/features/workbook/application/createWorkbookStore'
import type { WorkbookCopy } from '../src/features/workbook/application/workbookPorts'
import type { LedgerEntry } from '../src/features/workbook/domain/ledgerReading'
import { CORE_TABS, cellsOfRecord } from '../src/features/workbook/infrastructure/spreadsheetTab'
import { templateColumnNames } from '../src/features/workbook/infrastructure/workbookTemplate'
import { cellsOf } from './fixtures/recordWrites'
import type { CellValue } from '../src/features/workbook/infrastructure/workbookSnapshot'
import { tabsOfDocument } from '../src/features/workbook/infrastructure/spreadsheetDocument'
import { moneyFromCents } from '../src/shared/money/money'
import type { Money } from '../src/shared/money/money'
import { AN_ID, browserHarness, forgetCaches, driveHarness, ruleRow, workbookGrids } from './fixtures/writeBack'
import type { WriteBackHarness } from './fixtures/writeBack'

const used = new Set<string>()

afterEach(async () => {
  await forgetCaches(used)
})

const MAIN_IBAN = 'XX00FAKE0000000001'
const SAVINGS_IBAN = 'HR1723600001101234565'

/** The anonymised Erste credit statement, moved onto the harness's main account and its newest balance of 1000.00. */
function creditStatement(opening = '1000.00', closing = '1923.15'): string {
  return readFileSync(join(import.meta.dirname, 'fixtures', 'camt', 'erste-credit.xml'), 'utf8')
    .replace(/^﻿/, '')
    .replace('HR2923400091110000001', MAIN_IBAN)
    .replace(/(<Cd>OPBD<\/Cd>[\s\S]*?<Amt Ccy="EUR">)9030\.13/, `$1${opening}`)
    .replace(/(<Cd>CLBD<\/Cd>[\s\S]*?<Amt Ccy="EUR">)9953\.28/, `$1${closing}`)
}

function grids(): Record<string, CellValue[][]> {
  const base = workbookGrids()
  return {
    ...base,
    accounts: [['account', 'iban'], ['main', MAIN_IBAN], ['savings', SAVINGS_IBAN]],
    rules: [...base.rules!, ruleRow({ rule: 'client-northwind', order: 200, enabled: true, direction: 'credit', counterparty_iban: 'HR2420011116383368706', category: 'revenue', confidence: 'rule' })],
  }
}

function camtFile(xml: string, fileName = 'statement.xml') {
  return { kind: 'camt' as const, fileName, document: new DOMParser().parseFromString(xml, 'application/xml') }
}

function dryRun(store: WorkbookStore<WorkbookCopy>, xml: string, starts: ReadonlyMap<string, Money> = new Map()): ImportDryRun {
  const workbook = store.state.workbook!
  return dryRunFor(statementReadings(camtFile(xml), workbook, null), workbook, starts)
}

/** The ledger rows confirming would write, as the tab holds them. */
function rowsOf(run: ImportDryRun): Record<string, CellValue>[] {
  return run.added.map((entry) => {
    const cells = cellsOfRecord(CORE_TABS.ledger, entry)
    return Object.fromEntries(templateColumnNames('ledger').map((column) => [column, cells[column] ?? '']))
  })
}

/** Imports the entries, as Confirm import does. */
function importRows(store: WorkbookStore<WorkbookCopy>, added: readonly LedgerEntry[]) {
  return store.write('Imported', (unit) => added.forEach((entry) => unit.of(LEDGER_WRITES).add(entry)))
}

/** The ledger rows as an export writes them, in the order the file holds them. */
function ledgerCells(store: WorkbookStore<DocumentCopy>): Record<string, CellValue>[] {
  return tabsOfDocument(store.state.snapshot!.document).ledger.map((row) => row.cells)
}

describe('the import dry run', () => {
  it('lists a new entry with the verdict the rules give it, and the ledger row it would write with an id of its own', async () => {
    const { store } = await driveHarness(used, grids())
    const run = dryRun(store, creditStatement())

    expect(run.newRows).toBe(1)
    expect(run.statements[0]).toMatchObject({ account: 'main', label: '2031-03-12-statement-042', refusal: null, start: null })
    expect(run.statements[0]?.rows[0]).toMatchObject({ inLedger: false, balance: moneyFromCents(192_315), verdict: { category: 'revenue', flaggedBy: 'rule', ruleId: 'client-northwind' } })
    expect(rowsOf(run)).toEqual([
      {
        date: 47918,
        account: 'main',
        statement: '2031-03-12-statement-042',
        counterparty: 'Northwind Analytics Ltd',
        counterparty_iban: 'HR2420011116383368706',
        description: 'Invoice 3-1-31',
        amount: 923.15,
        balance: 1923.15,
        category: 'revenue',
        flagged_by: 'rule',
        reference: '2031-74101882-00752204301',
        purpose: '',
        tx_domain: 'PMNT',
        tx_family: 'RCDT',
        tx_sub_family: 'NTAV',
        creditor_reference: 'HR027926-19672674662-89804',
        instructed_currency: '',
        review_reasons: '',
        owner_share: '',
        id: AN_ID,
      },
    ])
  })

  it('files a new row with the default share of the category the rules give it', async () => {
    const base = grids()
    const { store } = await driveHarness(used, {
      ...base,
      categories: [
        ['category', 'family', 'bucket', 'roles', 'owner_share'],
        ['ai-services', 'operating', 'operating', '', 50],
        ['revenue', 'income', 'income', '', ''],
        ['benefits', 'owner', 'owner-pay', 'owner-benefit', ''],
      ],
      rules: base.rules!.map((row) => (row[0] === 'client-northwind' ? row.map((cell) => (cell === 'revenue' ? 'ai-services' : cell)) : row)),
    })
    const run = dryRun(store, creditStatement())

    expect(run.added.map((entry) => [entry.category, entry.ownerShare])).toEqual([['ai-services', 50]])
    await importRows(store, run.added)
    expect(store.state.workbook!.transactions.find((row) => row.counterparty === 'Northwind Analytics Ltd')).toMatchObject({ category: 'ai-services', ownerShare: 50 })
  })

  it('refuses a statement that does not open where the ledger leaves the account', async () => {
    const { store } = await driveHarness(used, grids())
    const run = dryRun(store, creditStatement('900.00', '1823.15'))

    expect(run.newRows).toBe(0)
    expect(run.statements[0]?.refusal).toBe(
      'The ledger ends main at 1000.00 on 2026-10-05, but this statement\'s first new entry starts from 900.00, so a statement between the two is missing. Import that one first.',
    )
  })

  it('waits for the person to start an account the ledger has no row of, then starts it at the statement’s opening', async () => {
    const { store } = await driveHarness(used, grids())
    const savings = creditStatement('250.00', '1173.15').replace(MAIN_IBAN, SAVINGS_IBAN)

    const waiting = dryRun(store, savings)
    expect(waiting.statements[0]).toMatchObject({ refusal: null, start: { account: 'savings', opening: moneyFromCents(25_000), date: '2031-03-11' } })
    expect(waiting.newRows).toBe(0)

    expect(dryRun(store, savings, new Map([['savings', moneyFromCents(25_000)]])).newRows).toBe(1)
    expect(dryRun(store, savings, new Map([['savings', moneyFromCents(1)]])).newRows).toBe(0)
  })

  it('writes nothing for a statement without entries and says it has none', async () => {
    const { store } = await driveHarness(used, grids())
    const quiet = creditStatement('1000.00', '1000.00')
      .replace(/<Ntry>[\s\S]*<\/Ntry>/, '')
      .replace(/(<TtlCdtNtries>\s*<NbOfNtries>)1(<\/NbOfNtries>\s*<Sum>)923\.15/, '$10$20.00')
    const run = dryRun(store, quiet)

    expect(run.newRows).toBe(0)
    expect(run.statements[0]).toMatchObject({ refusal: null, notes: ['The statement has no booked entries, so importing it writes nothing.'] })
  })

  it('refuses an entry without a reference, which a second import could not tell from others', async () => {
    const { store } = await driveHarness(used, grids())
    const unreferenced = creditStatement().replace(/<NtryRef>.*?<\/NtryRef>/, '').replace(/(<\/RvslInd>[\s\S]*?)<AcctSvcrRef>.*?<\/AcctSvcrRef>/, '$1')

    expect(dryRun(store, unreferenced).statements[0]?.refusal).toMatch(/^An entry carries no bank reference/)
  })

  it('takes two statements of one account oldest first, the second opening where the first closes, and notes a gap in their numbers', async () => {
    const { store } = await driveHarness(used, grids())
    const later = creditStatement('1923.15', '2846.30')
      .replace('<LglSeqNb>42</LglSeqNb>', '<LglSeqNb>44</LglSeqNb>')
      .replace(/2031-03-12T/g, '2031-03-14T')
      .replace(/<Dt>2031-03-11<\/Dt>/g, '<Dt>2031-03-13</Dt>')
      .replace(/2031-74101882-00752204301/g, '2031-00000000-00000000002')
    const second = later.slice(later.indexOf('<Stmt>'), later.indexOf('</Stmt>') + '</Stmt>'.length)
    const both = creditStatement().replace('<Stmt>', `${second}<Stmt>`)
    const run = dryRun(store, both)

    expect(run.statements.map((statement) => [statement.label, statement.refusal])).toEqual([
      ['2031-03-12-statement-042', null],
      ['2031-03-14-statement-044', null],
    ])
    expect(run.statements[1]?.notes).toEqual([
      'It is statement 44, and the newest on the ledger for main is 42, so one statement is not on the ledger. The balances still join, so it may have held no entries.',
    ])
    expect(run.added.map((entry) => entry.statement)).toEqual(['2031-03-12-statement-042', '2031-03-14-statement-044'])
  })
})

describe.each([
  ['a file on Drive', driveHarness],
  ['a workbook kept in this browser', browserHarness],
] as const)('importing into %s', (_name, harnessOf: (used: Set<string>, grids?: Record<string, CellValue[][]>) => Promise<WriteBackHarness>) => {
  it('adds the new rows with an id each, a second import finds them all, and Undo takes them out', async () => {
    const { store } = await harnessOf(used, grids())
    const before = ledgerCells(store)

    const receipt = await importRows(store, dryRun(store, creditStatement()).added)

    expect(cellsOf(receipt, 'add')).toHaveLength(1)
    expect(ledgerCells(store).at(-1)).toMatchObject({ date: 47918, account: 'main', amount: 923.15, balance: 1923.15, category: 'revenue', flagged_by: 'rule', id: AN_ID })
    expect(ledgerCells(store).slice(0, -1)).toEqual(before)
    expect(store.state.workbook?.transactions.find((row) => row.reference === '2031-74101882-00752204301')?.sequence).toBe(5)

    const again = dryRun(store, creditStatement())
    expect(again).toMatchObject({ newRows: 0, inLedger: 1, added: [] })
    expect(again.statements[0]?.notes).toEqual(['Every entry is on the ledger already, so importing it writes nothing.'])


    const write = store.state.writes[0]!
    await store.undo(write)
    expect(ledgerCells(store)).toEqual(before)
  })

  it('refuses rows another device filed since the dry run, and writes nothing', async () => {
    const { store } = await harnessOf(used, grids())
    const run = dryRun(store, creditStatement())
    await importRows(store, run.added)
    const after = ledgerCells(store)

    await expect(importRows(store, run.added)).rejects.toThrow(
      'The ledger row "2031-03-11, Northwind Analytics Ltd, 923.15, balance 1923.15" is in the workbook already, so it is not added again.',
    )
    expect(ledgerCells(store)).toEqual(after)
    expect(after).toHaveLength(5)
  })

  it('refuses rows that no longer open where the tab leaves the account', async () => {
    const { store } = await harnessOf(used, grids())
    const run = dryRun(store, creditStatement())
    const moved = run.added.map((entry) => ({ ...entry, balance: moneyFromCents(192_316) }))

    await expect(importRows(store, moved)).rejects.toThrow('The new main rows open at 1000.01, but the tab now leaves main at 1000.00.')
  })

  it('starts an account the ledger had no row of and puts its rows by date', async () => {
    const { store } = await harnessOf(used, grids())
    const savings = creditStatement('250.00', '1173.15').replace(MAIN_IBAN, SAVINGS_IBAN)
    const run = dryRun(store, savings, new Map([['savings', moneyFromCents(25_000)]]))

    await importRows(store, run.added)
    expect(ledgerCells(store).find((cells) => cells.account === 'savings')).toMatchObject({ balance: 1173.15 })
    expect(store.state.workbook?.transactions.filter((row) => row.account === 'savings').map((row) => row.balance)).toEqual([moneyFromCents(117_315)])
  })

  it('refuses to take out rows a newer row of the account follows', async () => {
    const { store } = await harnessOf(used, grids())
    await importRows(store, dryRun(store, creditStatement()).added)
    const imported = store.state.writes[0]!
    const later = creditStatement('1923.15', '2846.30').replace(/2031-03-12T/g, '2031-03-14T').replace(/<Dt>2031-03-11<\/Dt>/g, '<Dt>2031-03-13</Dt>').replace(/2031-74101882-00752204301/g, 'LATER-1').replace('<LglSeqNb>42</LglSeqNb>', '<LglSeqNb>43</LglSeqNb>')
    await importRows(store, dryRun(store, later).added)

    await expect(store.undo(imported)).rejects.toThrow('The main row of 2031-03-13 with the balance 2846.30 is booked after the rows to take out, so its balance follows from them.')
  })
})

describe('a tabular import through its profile', () => {
  it('works balances out from the ledger when the export gives none', async () => {
    const { store } = await driveHarness(used, grids())
    const profile: ImportProfile = { name: 'bank', account: 'main', date: 'Datum', dateFormat: 'dd.mm.yyyy', decimal: 'comma', amount: { signed: 'Iznos' }, balance: '', counterparty: 'Naziv', counterpartyIban: '', description: 'Opis', reference: '' }
    const grid = [['Datum', 'Naziv', 'Opis', 'Iznos'], ['17.10.2026', 'KAVANA PRIMJER', 'Kartično plaćanje', '-3,40'], ['16.10.2026', 'Northwind Analytics Ltd', 'Invoice 9-1-26', '7.150,00']]
    const file = { kind: 'table' as const, fileName: 'promet.csv', fileHash: 'f'.repeat(64), grid }
    const workbook = store.state.workbook!
    const run = dryRunFor(statementReadings(file, workbook, profile), workbook, new Map())

    expect(run.statements[0]?.notes).toEqual(['The file gives no balances, so they are worked out from 1000.00, where the ledger leaves main on 2026-10-05.'])
    expect(rowsOf(run).map((cells) => [cells.date, cells.amount, cells.balance, cells.statement])).toEqual([
      [46312, -3.4, 8146.6, 'promet (ffffffff)'],
      [46311, 7150, 8150, 'promet (ffffffff)'],
    ])
    expect(dryRunFor(statementReadings(file, workbook, { ...profile, account: 'nowhere' }), workbook, new Map()).statements[0]?.refusal).toMatch(/is for nowhere, which is not on the accounts tab/)
  })

  it('finds a file it imported on the ledger, and refuses it once a changed profile gives its rows other keys', async () => {
    const { store } = await driveHarness(used, grids())
    const profile: ImportProfile = { name: 'bank', account: 'main', date: 'Datum', dateFormat: 'dd.mm.yyyy', decimal: 'comma', amount: { signed: 'Iznos' }, balance: '', counterparty: 'Naziv', counterpartyIban: '', description: 'Opis', reference: '' }
    const grid = [['Datum', 'Naziv', 'Opis', 'Iznos'], ['17.10.2026', 'KAVANA PRIMJER', 'Kartično plaćanje', '-3,40'], ['16.10.2026', 'Northwind Analytics Ltd', 'Invoice 9-1-26', '7.150,00']]
    const file = { kind: 'table' as const, fileName: 'promet.csv', fileHash: 'f'.repeat(64), grid }
    const runOf = (read: ImportProfile) => dryRunFor(statementReadings(file, store.state.workbook!, read), store.state.workbook!, new Map())
    await importRows(store, runOf(profile).added)

    expect(runOf(profile)).toMatchObject({ newRows: 0, inLedger: 2 })
    const changed = runOf({ ...profile, description: 'Naziv' })
    expect(changed.newRows).toBe(0)
    expect(changed.statements[0]?.refusal).toBe(
      'Rows of promet (ffffffff) are on the ledger already, so this file was imported before, and none of its entries match them now, such as after a change to its profile. Nothing of it is written.',
    )
  })
})
