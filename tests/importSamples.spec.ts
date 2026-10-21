// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import { dryRunFor, statementReadings } from '../src/features/imports/application/importStatements'
import { accountNamedIn, fileShapeOf } from '../src/features/imports/domain/profileGuess'
import { SAMPLE_CAMT_FILE_NAME, SAMPLE_TABLE_FILE_NAME, sampleCamtXml, sampleTableGrid } from '../src/features/imports/infrastructure/fake/sampleImportFiles'
import { fakeWorkbookSnapshot } from '../src/features/workbook/infrastructure/fake/fakeWorkbook'
import { readWorkbook } from '../src/features/workbook/infrastructure/workbookReader'

const workbook = readWorkbook(fakeWorkbookSnapshot('2026-10-16T08:00:00.000Z'))
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
