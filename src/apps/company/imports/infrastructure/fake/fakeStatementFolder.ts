import { FAKE_BOOKS_STATEMENTS, PAGE_FAKE_MADE_FILES, sampleStatementByMail } from '../../../workbook/infrastructure/fake/fakeFolderFiles'
import type { FakeMadeFile } from '../../../workbook/infrastructure/fake/fakeFolderFiles'
import { FAKE_FOLDERS, fakeWorkbookRecords } from '../../../workbook/infrastructure/fake/fakeWorkbook'
import type { StatementFolder } from '../../application/statementFolder'
import type { StatementFile } from '../../domain/statementFiles'
import { sampleCamtLabel, sampleCamtXml } from './sampleImportFiles'

/** An IBAN no account of the fake workbook holds, so its statement waits for the person to add the account. */
const UNKNOWN_ACCOUNT_IBAN = 'XX43FAKE0000000000000003'

const SLOW_LISTING_MS = 3_000

/**
 * The fake build's statements folder at the path the made-up books name. It holds an XML name for
 * every statement on the fake ledger, which the name test skips and which has no contents here, and
 * the sample camt statement, which carries the main account on, with a PDF beside it. The variants
 * whose sample comes by mail hold it only once a sync filed it, and every file a sync made in the
 * folder is listed with its bytes, the page's files unless `made` gives others.
 * `?fake=held-statement` adds the first statement of an account the accounts tab lacks, named by its
 * label alone as the fetch names such a file, which the sync holds. `?fake=slow-statements` takes
 * three seconds to list the folder, so a check can see the sync control while the step runs. The
 * statements folder new books from mail make beside the books file holds what a sync filed there.
 */
export function fakeStatementFolder(variant: string | null, made: readonly FakeMadeFile[] = PAGE_FAKE_MADE_FILES): StatementFolder {
  const filed = [...new Set((fakeWorkbookRecords('drive')['ledger-row'] ?? []).map((row) => `${String(row.statement)}-${String(row.account)}.xml`))]
  const sample: StatementFile = { id: 'fake-statement-sample', name: `${sampleCamtLabel()}-main.xml` }
  const unknown: StatementFile = { id: 'fake-statement-unknown-account', name: `${sampleCamtLabel(1)}.xml` }
  const holding = FAKE_FOLDERS.statements.join('/')
  const files: StatementFile[] = [
    ...filed.map((name, index) => ({ id: `fake-statement-${index + 1}`, name })),
    ...(sampleStatementByMail(variant) ? [] : [sample, { id: 'fake-statement-sample-pdf', name: `${sampleCamtLabel()}.pdf` }]),
    ...(variant === 'held-statement' ? [unknown] : []),
  ]
  const besideBooks = FAKE_BOOKS_STATEMENTS.join('/')
  return {
    async files(path) {
      if (variant === 'slow-statements') {
        await new Promise((resolve) => setTimeout(resolve, SLOW_LISTING_MS))
      }
      const where = path.join('/')
      if (where !== holding && where !== besideBooks) {
        return { kind: 'refused', reason: `The fake Drive holds statements only in ${holding} and ${besideBooks}, not in ${where}.` }
      }
      const madeHere = made.flatMap((file, index) => (file.folder.join('/') === where ? [{ id: `fake-made-${index}`, name: file.name }] : []))
      return { kind: 'listed', files: [...(where === holding ? files : []), ...madeHere] }
    },

    async download(file) {
      const madeFile = file.id.startsWith('fake-made-') ? made[Number(file.id.slice('fake-made-'.length))] : undefined
      if (madeFile !== undefined) return madeFile.bytes
      const xml = file.id === sample.id ? sampleCamtXml() : file.id === unknown.id ? sampleCamtXml({ iban: UNKNOWN_ACCOUNT_IBAN, sequence: 1 }) : null
      if (xml === null) {
        throw new Error(`The fake Drive holds only the name of ${file.name}, a statement already on the fake ledger.`)
      }
      return new TextEncoder().encode(xml).buffer as ArrayBuffer
    },
  }
}
