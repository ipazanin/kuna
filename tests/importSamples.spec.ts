// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import { dryRunFor, statementReadings } from '../src/features/imports/application/importStatements'
import { accountNamedIn, fileShapeOf } from '../src/features/imports/domain/profileGuess'
import { DEFAULT_STATEMENTS_FOLDER, statementFilesToRead } from '../src/features/imports/domain/statementFiles'
import { fakeStatementFolder } from '../src/features/imports/infrastructure/fake/fakeStatementFolder'
import { SAMPLE_CAMT_FILE_NAME, SAMPLE_TABLE_FILE_NAME, sampleCamtLabel, sampleCamtXml, sampleTableGrid } from '../src/features/imports/infrastructure/fake/sampleImportFiles'
import { loadImportFile } from '../src/features/imports/infrastructure/importFiles'
import { fakeWorkbookSnapshot } from './fixtures/fakeBooks'
import { readSnapshot } from '../src/features/workbook/infrastructure/spreadsheetTab'

const workbook = readSnapshot(fakeWorkbookSnapshot('2026-10-16T08:00:00.000Z')).workbook
const camt = { kind: 'camt' as const, fileName: SAMPLE_CAMT_FILE_NAME, document: new DOMParser().parseFromString(sampleCamtXml(), 'application/xml') }
const grid = sampleTableGrid()
const guess = fileShapeOf(grid)!.guess
const profile = { ...guess, name: 'example-bank', account: accountNamedIn(grid, workbook.accounts) }
const table = { kind: 'table' as const, fileName: SAMPLE_TABLE_FILE_NAME, fileHash: 'e'.repeat(64), grid }

describe('the fake build’s sample statement files', () => {
  it('carry the main account on with four new rows each, categorised by the fake rules', () => {
    const fromCamt = dryRunFor(statementReadings(camt, workbook, null), workbook, new Map())
    const fromTable = dryRunFor(statementReadings(table, workbook, profile), workbook, new Map())

    expect(fromCamt.newRows).toBe(4)
    expect(fromCamt.statements[0]?.rows.map((row) => [row.counterparty, row.verdict?.category, row.reviewReasons])).toEqual([
      ['Northwind Analytics Ltd', 'revenue', []],
      ['MODEL API SUBSCRIPTION', 'ai-services', []],
      ['Example Bank d.d.', 'unknown', []],
      ['SNACK KIOSK', 'card-purchase-unknown', ['reversal']],
    ])
    expect(profile.account).toBe('main')
    expect(fromTable.newRows).toBe(4)
    expect(fromTable.statements[0]?.notes).toEqual(['Row 9 reads "Ukupno" where the date goes, so it is skipped.'])
  })

  it('start from the same balance, so only one of them can follow the ledger', () => {
    const run = dryRunFor([...statementReadings(camt, workbook, null), ...statementReadings(table, workbook, profile)], workbook, new Map())

    expect(run.statements.map((statement) => [statement.fileName, statement.refusal])).toEqual([
      [SAMPLE_TABLE_FILE_NAME, null],
      [SAMPLE_CAMT_FILE_NAME, 'Its first new entry is dated 2026-10-12, before 2026-10-14, the newest row of main. Rows are only added after the newest one.'],
    ])
    expect(run.newRows).toBe(4)
  })
})

describe('the fake build’s statements folder', () => {
  it('holds a name for every statement on the fake ledger and the sample camt statement, the only file the name test reads', async () => {
    const folder = fakeStatementFolder(null)
    const listing = await folder.files(DEFAULT_STATEMENTS_FOLDER)
    if (listing.kind !== 'listed') throw new Error(listing.reason)
    const toRead = statementFilesToRead(listing.files, workbook.transactions)

    expect(listing.files.length).toBeGreaterThan(100)
    expect(toRead.map((file) => file.name)).toEqual([`${sampleCamtLabel()}-main.xml`])
    const loaded = await loadImportFile(toRead[0]!.name, await folder.download(toRead[0]!))
    const run = dryRunFor(statementReadings(loaded, workbook, null), workbook, new Map())
    expect(run.statements.map((statement) => [statement.label, statement.account, statement.refusal])).toEqual([[sampleCamtLabel(), 'main', null]])
    expect(run.newRows).toBe(4)
  })

  it('holds, under ?fake=held-statement, the first statement of an account the accounts tab lacks, named by its label alone', async () => {
    const folder = fakeStatementFolder('held-statement')
    const listing = await folder.files(DEFAULT_STATEMENTS_FOLDER)
    if (listing.kind !== 'listed') throw new Error(listing.reason)
    const toRead = statementFilesToRead(listing.files, workbook.transactions)

    expect(toRead.map((file) => file.name)).toEqual([`${sampleCamtLabel()}-main.xml`, `${sampleCamtLabel(1)}.xml`])
    const loaded = await loadImportFile(toRead[1]!.name, await folder.download(toRead[1]!))
    expect(statementReadings(loaded, workbook, null)).toEqual([
      { fileName: `${sampleCamtLabel(1)}.xml`, label: sampleCamtLabel(1), refusal: 'The accounts tab names no account for IBAN XX00FAKE0000000000000003, so the statement cannot be filed. Add the account on Settings, Accounts first.' },
    ])
  })

  it('refuses any other path, and a download of a statement it holds only the name of', async () => {
    const folder = fakeStatementFolder(null)

    expect(await folder.files(['work', 'statements'])).toEqual({ kind: 'refused', reason: `The fake Drive holds statements only in ${DEFAULT_STATEMENTS_FOLDER.join('/')}, not in work/statements.` })
    await expect(folder.download({ id: 'fake-statement-1', name: 'filed.xml' })).rejects.toThrow('holds only the name of filed.xml')
  })
})
