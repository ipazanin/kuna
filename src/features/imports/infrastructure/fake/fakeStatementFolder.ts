import { fakeWorkbookValues } from '../../../workbook/infrastructure/fake/fakeWorkbook'
import type { StatementFolder } from '../../application/statementFolder'
import { DEFAULT_STATEMENTS_FOLDER } from '../../domain/statementFiles'
import type { StatementFile } from '../../domain/statementFiles'
import { sampleCamtLabel, sampleCamtXml } from './sampleImportFiles'

/** An IBAN no account of the fake workbook holds, so its statement is refused until the account is added. */
const UNKNOWN_ACCOUNT_IBAN = 'XX00FAKE0000000000000003'

/**
 * The fake build's statements folder at the default path. It holds an XML name for every statement
 * on the fake ledger, which the name test skips and which has no contents here, and the sample camt
 * statement, which carries the main account on, with a PDF beside it. `?fake=held-statement` adds
 * the first statement of an account the accounts tab lacks, named by its label alone as the fetch
 * names such a file, which the sync holds.
 */
export function fakeStatementFolder(variant: string | null): StatementFolder {
  const values = fakeWorkbookValues('google')
  const filed = [...new Set(values.ledger.slice(1).map((row) => `${String(row[2])}-${String(row[1])}.xml`))]
  const sample: StatementFile = { id: 'fake-statement-sample', name: `${sampleCamtLabel()}-main.xml` }
  const unknown: StatementFile = { id: 'fake-statement-unknown-account', name: `${sampleCamtLabel(1)}.xml` }
  const files: StatementFile[] = [
    ...filed.map((name, index) => ({ id: `fake-statement-${index + 1}`, name })),
    sample,
    { id: 'fake-statement-sample-pdf', name: `${sampleCamtLabel()}.pdf` },
    ...(variant === 'held-statement' ? [unknown] : []),
  ]
  return {
    async files(path) {
      const where = path.join('/')
      const holding = DEFAULT_STATEMENTS_FOLDER.join('/')
      return where === holding ? { kind: 'listed', files } : { kind: 'refused', reason: `The fake Drive holds statements only in ${holding}, not in ${where}.` }
    },

    async download(file) {
      const xml = file.id === sample.id ? sampleCamtXml() : file.id === unknown.id ? sampleCamtXml({ iban: UNKNOWN_ACCOUNT_IBAN, sequence: 1 }) : null
      if (xml === null) {
        throw new Error(`The fake Drive holds only the name of ${file.name}, a statement already on the fake ledger.`)
      }
      return new TextEncoder().encode(xml).buffer as ArrayBuffer
    },
  }
}
