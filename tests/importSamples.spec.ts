// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import { dryRunFor, statementReadings } from '../src/apps/company/imports/application/importStatements'
import { accountNamedIn, fileShapeOf } from '../src/apps/company/imports/domain/profileGuess'
import { readStatementMail } from '../src/apps/company/mail/application/statementMail'
import { fakeMailbox } from '../src/apps/company/mail/infrastructure/fake/fakeMailbox'
import { mailWindow } from '../src/shared/mail/domain/mailSource'
import { SAMPLE_CAMT_FILE_NAME, SAMPLE_TABLE_FILE_NAME, sampleCamtLabel, sampleCamtXml, sampleTableGrid } from '../src/apps/company/imports/infrastructure/fake/sampleImportFiles'
import { loadImportFile } from '../src/apps/company/imports/infrastructure/importFiles'
import { fakeWorkbookSnapshot } from './fixtures/fakeBooks'
import { readSnapshot } from '../src/apps/company/workbook/infrastructure/spreadsheetTab'
import { noteText, refusalText } from '../src/apps/company/imports/presentation/dryRunWords'
import { BY_HAND_SOURCES } from '../src/apps/company/workbook/domain/workbook'

const FAKE_BOOKS = readSnapshot(fakeWorkbookSnapshot('2026-10-16T08:00:00.000Z'))
const workbook = FAKE_BOOKS.workbook
const camt = { kind: 'camt' as const, fileName: SAMPLE_CAMT_FILE_NAME, document: new DOMParser().parseFromString(sampleCamtXml(), 'application/xml') }
const grid = sampleTableGrid()
const guess = fileShapeOf(grid)!.guess
const profile = { ...guess, name: 'example-bank', account: accountNamedIn(grid, workbook.accounts) }
const table = { kind: 'table' as const, fileName: SAMPLE_TABLE_FILE_NAME, fileHash: 'e'.repeat(64), grid }

describe('the fake build’s sample statement files', () => {
  it('carry the main account on with four new rows from the camt file, which main takes from the day after its newest row, and refuse the sheet, which no day of main takes', () => {
    const fromCamt = dryRunFor(statementReadings(camt, workbook, null), FAKE_BOOKS, new Map())
    const fromTable = dryRunFor(statementReadings(table, workbook, profile), FAKE_BOOKS, new Map())

    expect(fromCamt.newRows).toBe(4)
    expect(fromCamt.statements[0]?.rows.map((row) => [row.counterparty, row.verdict?.category, row.reviewReasons])).toEqual([
      ['Northwind Analytics Ltd', 'revenue', []],
      ['MODEL API SUBSCRIPTION', 'ai-services', []],
      ['Example Bank d.d.', 'unknown', []],
      ['SNACK KIOSK', 'card-purchase-unknown', ['reversal']],
    ])
    expect(profile.account).toBe('main')
    expect(fromTable.newRows).toBe(0)
    expect(fromTable.statements[0]?.refusal).toMatchObject({ kind: 'other-source', account: 'main', origin: 'by-hand' })
    expect(fromTable.statements[0]?.notes.map(noteText)).toEqual(['Row 9 reads "Ukupno" where the date goes, so it is skipped.'])
  })

  it('start from the same balance, so only one of them can follow the ledger on an account kept by hand', () => {
    const byHand = { ...FAKE_BOOKS, workbook: { ...workbook, accounts: workbook.accounts.map((account) => ({ ...account, sources: BY_HAND_SOURCES })) } }
    const run = dryRunFor([...statementReadings(camt, workbook, null), ...statementReadings(table, workbook, profile)], byHand, new Map())

    expect(run.statements.map((statement) => [statement.fileName, statement.refusal && refusalText(statement.refusal)])).toEqual([
      [SAMPLE_TABLE_FILE_NAME, null],
      [SAMPLE_CAMT_FILE_NAME, 'Its first new entry is dated 12 Oct 2026, before 14 Oct 2026, the newest row of main. Rows are only added after the newest one.'],
    ])
    expect(run.newRows).toBe(4)
  })
})

/** What the fake build's bank mail gives to a sync whose search starts a week before the main account's newest statement. */
async function readFakeMail(variant: string | null) {
  const newest = workbook.transactions.filter((row) => row.account === 'main').reduce((last, row) => (row.date > last ? row.date : last), '')
  return readStatementMail({
    mailbox: fakeMailbox(variant),
    search: { senders: ['statements@bank.example.com'], subject: 'Izvadak' },
    window: mailWindow(Date.parse(`${newest}T00:00:00Z`), Date.parse('2026-01-01T00:00:00Z')),
    workbook,
    load: loadImportFile,
    known: new Map(),
  })
}

describe('the fake build’s bank mail', () => {
  it('mails the sample camt statement twice, which reads once and carries main on with four rows where the mail fills it, beside PDFs passed over and a notice that is no statement', async () => {
    const plan = await readFakeMail(null)
    // The mail variants keep main's mail period alone, as the default books give its days after the newest row to its camt file.
    const mailOnly = {
      ...FAKE_BOOKS,
      workbook: { ...workbook, accounts: workbook.accounts.map((account) => (account.slug === 'main' ? { ...account, sources: account.sources.slice(0, 1) } : account)) },
    }

    expect(plan.entries.map((entry) => entry.kind).sort()).toEqual(['not-read', 'passed-over', 'passed-over', 'passed-over', 'read', 'read'])
    expect(plan.entries.filter((entry) => entry.kind === 'read').map((entry) => entry.label)).toEqual([sampleCamtLabel(), sampleCamtLabel()])
    const run = dryRunFor(plan.readings, mailOnly, new Map(), new Map(), new Map(), false, 'automation')
    expect(run.statements.map((statement) => [statement.label, statement.account, statement.refusal && refusalText(statement.refusal)])).toEqual([[sampleCamtLabel(), 'main', null]])
    expect(run.newRows).toBe(4)
  })

  it('adds, under ?fake=held-statement, the first statement of an account the accounts tab lacks', async () => {
    const plan = await readFakeMail('held-statement')

    expect(plan.readings).toMatchObject([
      { statement: { label: sampleCamtLabel() } },
      { statement: { account: '', label: sampleCamtLabel(1) }, newAccount: { iban: 'XX43FAKE0000000000000003', currency: 'EUR' } },
    ])
  })

  it('keeps, under ?fake=mail-nothing-new, only mail whose statements the books already hold', async () => {
    const plan = await readFakeMail('mail-nothing-new')

    expect(plan.readings).toEqual([])
    expect(plan.entries.map((entry) => entry.kind).sort()).toEqual(['not-read', 'passed-over'])
  })
})
