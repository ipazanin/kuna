// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { LEDGER_ROWS, placeBlocks } from '../src/features/imports/application/ledgerRows'
import { dryRunFor, statementReadings } from '../src/features/imports/application/importStatements'
import type { ImportDryRun } from '../src/features/imports/domain/importDryRun'
import type { ImportProfile } from '../src/features/imports/domain/importProfile'
import type { WorkbookStore } from '../src/features/workbook/application/workbookStore'
import type { RowCells } from '../src/features/workbook/domain/rowChanges'
import type { CellValue } from '../src/features/workbook/infrastructure/workbookSnapshot'
import { sheetRowsFromValues } from '../src/features/workbook/infrastructure/workbookSnapshot'
import { moneyFromCents } from '../src/shared/money/money'
import type { Money } from '../src/shared/money/money'
import { LEDGER_HEADER, LEDGER_ROWS as LEDGER_VALUES, excelHarness, forgetCaches, googleHarness, ruleRow, workbookGrids } from './fixtures/writeBack'
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

function dryRun(store: WorkbookStore, xml: string, starts: ReadonlyMap<string, Money> = new Map()): ImportDryRun {
  const workbook = store.state.workbook!
  return dryRunFor(statementReadings(camtFile(xml), workbook, null), workbook, starts)
}

function ledgerCells(store: WorkbookStore): Record<string, CellValue>[] {
  return [...store.state.snapshot!.ledger].sort((upper, lower) => upper.sheetRow - lower.sheetRow).map((row) => row.cells)
}

describe('the import dry run', () => {
  it('lists a new entry with the verdict the rules give it, and the ledger row it would write', async () => {
    const { store } = await googleHarness(used, grids())
    const run = dryRun(store, creditStatement())

    expect(run.newRows).toBe(1)
    expect(run.statements[0]).toMatchObject({ account: 'main', label: '2031-03-12-statement-042', refusal: null, start: null })
    expect(run.statements[0]?.rows[0]).toMatchObject({ inLedger: false, balance: moneyFromCents(192_315), verdict: { category: 'revenue', flaggedBy: 'rule', ruleId: 'client-northwind' } })
    expect(run.added).toEqual([
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
      },
    ])
  })

  it('refuses a statement that does not open where the ledger leaves the account', async () => {
    const { store } = await googleHarness(used, grids())
    const run = dryRun(store, creditStatement('900.00', '1823.15'))

    expect(run.newRows).toBe(0)
    expect(run.statements[0]?.refusal).toBe(
      'The ledger ends main at 1000.00 on 2026-10-05, but this statement\'s first new entry starts from 900.00, so a statement between the two is missing. Import that one first.',
    )
  })

  it('waits for the person to start an account the ledger has no row of, then starts it at the statement’s opening', async () => {
    const { store } = await googleHarness(used, grids())
    const savings = creditStatement('250.00', '1173.15').replace(MAIN_IBAN, SAVINGS_IBAN)

    const waiting = dryRun(store, savings)
    expect(waiting.statements[0]).toMatchObject({ refusal: null, start: { account: 'savings', opening: moneyFromCents(25_000), date: '2031-03-11' } })
    expect(waiting.newRows).toBe(0)

    expect(dryRun(store, savings, new Map([['savings', moneyFromCents(25_000)]])).newRows).toBe(1)
    expect(dryRun(store, savings, new Map([['savings', moneyFromCents(1)]])).newRows).toBe(0)
  })

  it('writes nothing for a statement without entries and says it has none', async () => {
    const { store } = await googleHarness(used, grids())
    const quiet = creditStatement('1000.00', '1000.00')
      .replace(/<Ntry>[\s\S]*<\/Ntry>/, '')
      .replace(/(<TtlCdtNtries>\s*<NbOfNtries>)1(<\/NbOfNtries>\s*<Sum>)923\.15/, '$10$20.00')
    const run = dryRun(store, quiet)

    expect(run.newRows).toBe(0)
    expect(run.statements[0]).toMatchObject({ refusal: null, notes: ['The statement has no booked entries, so importing it writes nothing.'] })
  })

  it('refuses an entry without a reference, as the Apps Script does', async () => {
    const { store } = await googleHarness(used, grids())
    const unreferenced = creditStatement().replace(/<NtryRef>.*?<\/NtryRef>/, '').replace(/(<\/RvslInd>[\s\S]*?)<AcctSvcrRef>.*?<\/AcctSvcrRef>/, '$1')

    expect(dryRun(store, unreferenced).statements[0]?.refusal).toMatch(/^An entry carries no bank reference/)
  })

  it('takes two statements of one account oldest first, the second opening where the first closes, and notes a gap in their numbers', async () => {
    const { store } = await googleHarness(used, grids())
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
    expect(run.added.map((cells) => cells.statement)).toEqual(['2031-03-12-statement-042', '2031-03-14-statement-044'])
  })
})

describe('placing statement rows where the Apps Script inserts a batch', () => {
  const rows = sheetRowsFromValues([LEDGER_HEADER, ...LEDGER_VALUES])
  const cells = (date: number, statement: string, account = 'main'): RowCells => ({ date, statement, account })

  it('puts a newer statement on top and an older one above the first row not newer than its newest day', () => {
    expect(placeBlocks(rows, [cells(46310, 'new'), cells(46309, 'new')], 5)).toEqual([{ index: 0, before: 2 }, { index: 1, before: 2 }])
    expect(placeBlocks(rows, [cells(46299, 'mid', 'other')], 5)).toEqual([{ index: 0, before: 3 }])
    expect(placeBlocks(rows, [cells(46000, 'old', 'other')], 5)).toEqual([{ index: 0, before: 6 }])
  })

  it('places each statement among the rows the ones before it put in, so the block of a later one lands above', () => {
    expect(placeBlocks(rows, [cells(46301, 'first'), cells(46302, 'second')], 5)).toEqual([{ index: 1, before: 2 }, { index: 0, before: 2 }])
  })
})

describe.each([
  ['a Google Sheet', googleHarness],
  ['a workbook kept in this browser', excelHarness],
] as const)('importing into %s', (name, harnessOf: (used: Set<string>, grids?: Record<string, CellValue[][]>) => Promise<WriteBackHarness>) => {
  it('puts the new rows in on top, newest first, a second import finds them all, and Undo takes them out', async () => {
    const { store, sheets } = await harnessOf(used, grids())
    const before = ledgerCells(store)

    const receipt = await store.changeRows(LEDGER_ROWS, { added: dryRun(store, creditStatement()).added, changed: [], removed: [] })

    expect(receipt?.added.map((row) => row.sheetRow)).toEqual([2])
    expect(ledgerCells(store)[0]).toMatchObject({ date: 47918, account: 'main', amount: 923.15, balance: 1923.15, category: 'revenue', flagged_by: 'rule' })
    expect(ledgerCells(store).slice(1)).toEqual(before)
    expect(store.state.workbook?.transactions.find((row) => row.reference === '2031-74101882-00752204301')?.sequence).toBe(5)

    const again = dryRun(store, creditStatement())
    expect(again).toMatchObject({ newRows: 0, inLedger: 1, added: [] })
    expect(again.statements[0]?.notes).toEqual(['Every entry is on the ledger already, so importing it writes nothing.'])

    if (name === 'a Google Sheet') {
      const structural = sheets.requests.filter((request) => request.kind === 'updateSpreadsheet')
      expect(structural).toEqual([
        {
          kind: 'updateSpreadsheet',
          requests: [
            { insertDimension: { range: { sheetId: 0, dimension: 'ROWS', startIndex: 1, endIndex: 2 }, inheritFromBefore: false } },
            { copyPaste: { source: { sheetId: 0, startRowIndex: 2, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: 18 }, destination: { sheetId: 0, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 18 }, pasteType: 'PASTE_FORMAT', pasteOrientation: 'NORMAL' } },
            { copyPaste: { source: { sheetId: 0, startRowIndex: 2, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: 18 }, destination: { sheetId: 0, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 18 }, pasteType: 'PASTE_DATA_VALIDATION', pasteOrientation: 'NORMAL' } },
          ],
        },
      ])
      expect(sheets.requests.filter((request) => request.kind === 'batchUpdate').flatMap((request) => (request.kind === 'batchUpdate' ? request.request.data.map((write) => write.range) : []))).toEqual(['ledger!A2:R2'])
    }

    const write = store.state.writes[0]!
    await store.undo(write)
    expect(ledgerCells(store)).toEqual(before)
    if (name === 'a Google Sheet') {
      expect(sheets.requests.at(-3)).toEqual({ kind: 'updateSpreadsheet', requests: [{ deleteDimension: { range: { sheetId: 0, dimension: 'ROWS', startIndex: 1, endIndex: 2 } } }] })
      expect(sheets.grids.ledger?.length).toBe(5)
    }
  })

  it('refuses rows the ingest filed since the dry run, and writes nothing', async () => {
    const { store, sheets } = await harnessOf(used, grids())
    const run = dryRun(store, creditStatement())
    await store.changeRows(LEDGER_ROWS, { added: run.added, changed: [], removed: [] })
    const after = ledgerCells(store)

    await expect(store.changeRows(LEDGER_ROWS, { added: run.added, changed: [], removed: [] })).rejects.toThrow(
      'One of these rows is on the ledger tab already, such as the main row with reference 2031-74101882-00752204301. The morning ingest may have filed it since the dry run. Look at the dry run again.',
    )
    expect(ledgerCells(store)).toEqual(after)
    expect(name === 'a Google Sheet' ? sheets.grids.ledger?.length : after.length).toBe(name === 'a Google Sheet' ? 6 : 5)
  })

  it('refuses rows that no longer open where the tab leaves the account', async () => {
    const { store } = await harnessOf(used, grids())
    const run = dryRun(store, creditStatement())
    const moved = run.added.map((cells) => ({ ...cells, balance: 1923.16 }))

    await expect(store.changeRows(LEDGER_ROWS, { added: moved, changed: [], removed: [] })).rejects.toThrow('The new main rows open at 1000.01, but the tab now leaves main at 1000.00.')
  })

  it('starts an account the ledger had no row of and puts its rows by date', async () => {
    const { store } = await harnessOf(used, grids())
    const savings = creditStatement('250.00', '1173.15').replace(MAIN_IBAN, SAVINGS_IBAN)
    const run = dryRun(store, savings, new Map([['savings', moneyFromCents(25_000)]]))

    await store.changeRows(LEDGER_ROWS, { added: run.added, changed: [], removed: [] })
    expect(store.state.workbook?.transactions.filter((row) => row.account === 'savings').map((row) => [row.sheetRow, row.balance])).toEqual([[2, moneyFromCents(117_315)]])
  })

  it('refuses to take out rows a newer row of the account follows', async () => {
    const { store } = await harnessOf(used, grids())
    await store.changeRows(LEDGER_ROWS, { added: dryRun(store, creditStatement()).added, changed: [], removed: [] })
    const imported = store.state.writes[0]!
    const later = creditStatement('1923.15', '2846.30').replace(/2031-03-12T/g, '2031-03-14T').replace(/<Dt>2031-03-11<\/Dt>/g, '<Dt>2031-03-13</Dt>').replace(/2031-74101882-00752204301/g, 'LATER-1').replace('<LglSeqNb>42</LglSeqNb>', '<LglSeqNb>43</LglSeqNb>')
    await store.changeRows(LEDGER_ROWS, { added: dryRun(store, later).added, changed: [], removed: [] })

    await expect(store.undo(imported)).rejects.toThrow('Row 2 of main sits above the rows to take out, so its balance follows from them.')
  })
})

describe('a tabular import through its profile', () => {
  it('works balances out from the ledger when the export gives none', async () => {
    const { store } = await googleHarness(used, grids())
    const profile: ImportProfile = { name: 'bank', account: 'main', date: 'Datum', dateFormat: 'dd.mm.yyyy', decimal: 'comma', amount: { signed: 'Iznos' }, balance: '', counterparty: 'Naziv', counterpartyIban: '', description: 'Opis', reference: '' }
    const grid = [['Datum', 'Naziv', 'Opis', 'Iznos'], ['17.10.2026', 'KAVANA PRIMJER', 'Kartično plaćanje', '-3,40'], ['16.10.2026', 'Northwind Analytics Ltd', 'Invoice 9-1-26', '7.150,00']]
    const file = { kind: 'table' as const, fileName: 'promet.csv', fileHash: 'f'.repeat(64), grid }
    const workbook = store.state.workbook!
    const run = dryRunFor(statementReadings(file, workbook, profile), workbook, new Map())

    expect(run.statements[0]?.notes).toEqual(['The file gives no balances, so they are worked out from 1000.00, where the ledger leaves main on 2026-10-05.'])
    expect(run.added.map((cells) => [cells.date, cells.amount, cells.balance, cells.statement])).toEqual([
      [46312, -3.4, 8146.6, 'promet (ffffffff)'],
      [46311, 7150, 8150, 'promet (ffffffff)'],
    ])
    expect(dryRunFor(statementReadings(file, workbook, { ...profile, account: 'nowhere' }), workbook, new Map()).statements[0]?.refusal).toMatch(/is for nowhere, which is not on the accounts tab/)
  })
})
