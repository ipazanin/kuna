// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import { dryRunFor, statementReadings } from '../src/features/imports/application/importStatements'
import { statementFilesToRead } from '../src/features/imports/domain/statementFiles'
import type { StatementFile } from '../src/features/imports/domain/statementFiles'
import { fakeWorkbookSnapshot } from './fixtures/fakeBooks'
import { readSnapshot } from '../src/features/workbook/infrastructure/spreadsheetTab'

const FAKE = readSnapshot(fakeWorkbookSnapshot('2026-10-16T08:00:00.000Z')).workbook

const LEDGER = [
  { account: 'erste', statement: '2026-04-06-statement-110' },
  { account: 'erste', statement: '2026-04-07-statement-111' },
  { account: 'card', statement: '2026-04-08-statement-104' },
]

function named(...names: string[]): StatementFile[] {
  return names.map((name, index) => ({ id: `file-${index + 1}`, name }))
}

describe('statementFilesToRead', () => {
  it('skips a file whose label and account are on the ledger together and reads the rest', () => {
    const files = named('2026-04-06-statement-110-erste.xml', '2026-04-07-statement-111-erste.xml', '2026-04-10-statement-112-erste.xml')

    expect(statementFilesToRead(files, LEDGER).map((file) => file.name)).toEqual(['2026-04-10-statement-112-erste.xml'])
  })

  it('reads a file whose label the ledger holds for another account only', () => {
    expect(statementFilesToRead(named('2026-04-08-statement-104-erste.xml'), LEDGER)).toHaveLength(1)
  })

  it('compares the account in the name regardless of case, as the ledger reads it', () => {
    expect(statementFilesToRead(named('2026-04-06-statement-110-Erste.XML'), LEDGER)).toEqual([])
  })

  it('reads a label-only file, named so while its IBAN was on no account, even when the label is on the ledger', () => {
    expect(statementFilesToRead(named('2026-04-06-statement-110.xml'), LEDGER)).toHaveLength(1)
  })

  it('reads a statement with no entries on every sync, since filing it puts no label on the ledger', () => {
    const empty = { id: 'file-1', name: '2026-10-20-statement-091-main.xml' }
    const document = new DOMParser().parseFromString(
      `<Document><BkToCstmrStmt><Stmt><LglSeqNb>91</LglSeqNb><CreDtTm>2026-10-20T06:00:00</CreDtTm>
        <Acct><Id><IBAN>${FAKE.accounts.find((account) => account.slug === 'main')!.iban}</IBAN></Id><Ccy>EUR</Ccy></Acct>
        <Bal><Tp><CdOrPrtry><Cd>OPBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">10.00</Amt><CdtDbtInd>CRDT</CdtDbtInd></Bal>
        <Bal><Tp><CdOrPrtry><Cd>CLBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">10.00</Amt><CdtDbtInd>CRDT</CdtDbtInd></Bal>
      </Stmt></BkToCstmrStmt></Document>`,
      'application/xml',
    )
    const run = dryRunFor(statementReadings({ kind: 'camt', fileName: empty.name, document }, FAKE, null), FAKE, new Map())

    expect(run.statements.map((statement) => [statement.label, statement.refusal, statement.rows.length])).toEqual([['2026-10-20-statement-091', null, 0]])
    expect(run.added).toEqual([])
    expect(statementFilesToRead([empty], FAKE.transactions)).toEqual([empty])
  })

  it('leaves out every file that is not XML and reads an XML file named another way', () => {
    const files = named('2026-04-06-statement-110.pdf', 'notes.txt', 'export.xml')

    expect(statementFilesToRead(files, LEDGER).map((file) => file.name)).toEqual(['export.xml'])
  })
})
