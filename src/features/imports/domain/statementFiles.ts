import type { Transaction } from '../../workbook/domain/workbook'

/** A file in the statements folder, by its Drive id and name. */
export interface StatementFile {
  readonly id: string
  readonly name: string
}

/**
 * The statement label and the account an archived camt file's name carries, as the fetch names it:
 * `<label>-<account>.xml`, or `<label>.xml` for a statement whose IBAN the accounts tab did not
 * name. Null for a name the fetch does not give.
 */
function archivedIdentityOf(name: string): { readonly label: string; readonly account: string } | null {
  const match = /^(\d{4}-\d{2}-\d{2}-statement-\d+)(?:-(.+))?\.xml$/i.exec(name)
  return match === null ? null : { label: match[1]!, account: (match[2] ?? '').trim().toLowerCase() }
}

/**
 * The XML files worth downloading: every one except those whose name carries a label and an
 * account the ledger already holds together. A name without an account says nothing about whose
 * statement it is, so that file is read. This only saves downloads. The dry run and the write rules
 * still decide what is written.
 */
export function statementFilesToRead(files: readonly StatementFile[], ledger: readonly Pick<Transaction, 'account' | 'statement'>[]): StatementFile[] {
  const filed = new Set(ledger.map((transaction) => filedKey(transaction.account, transaction.statement)))
  return files.filter((file) => {
    if (!file.name.toLowerCase().endsWith('.xml')) return false
    const archived = archivedIdentityOf(file.name)
    return archived === null || archived.account === '' || !filed.has(filedKey(archived.account, archived.label))
  })
}

function filedKey(account: string, label: string): string {
  return JSON.stringify([account, label.trim()])
}
