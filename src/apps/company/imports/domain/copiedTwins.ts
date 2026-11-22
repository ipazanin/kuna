import { bookedTwins } from '../../../../shared/money/lookAlikeBookings'
import type { TwinAnswer } from '../../../../shared/money/lookAlikeBookings'
import type { Transaction } from '../../workbook/domain/workbook'
import { isTranscribedReference } from '../../workbook/domain/rowOrigin'
import type { ImportedRow, ImportedStatement } from './importedStatement'

/** An entry of a file Kuna read that looks like a row the AI copied, and what the person said of it, null until they say. */
export interface CopiedTwinQuestion {
  /** The entry's `copiedTwinKey`, which the answer goes under. */
  readonly key: string
  readonly row: ImportedRow
  readonly copied: Transaction
  readonly keep: TwinAnswer['keep'] | null
}

/** What tells an entry of a file from every other: its account and its reference. */
export function copiedTwinKey(account: string, row: Pick<ImportedRow, 'reference'>): string {
  return `${account} ${row.reference}`
}

/** How a statement's entries meet the account's rows of the other source: a copied statement's against the rows of files, and a file's against the rows the AI copied. */
export interface CopiedTwins {
  /** For each entry of the statement, whether it counts as on the ledger. */
  readonly inLedger: readonly boolean[]
  /** The ledger row a copied entry only looks like, which holds it until the person says to import it. */
  readonly likeOf: ReadonlyMap<ImportedRow, Transaction>
  /** The copied row an entry of a file looks like. */
  readonly copiedTwinOf: ReadonlyMap<ImportedRow, Transaction>
  /** The entry of the file each copied row is or looks like, while it counts as on the ledger. */
  readonly twinOnLedger: ReadonlyMap<Transaction, ImportedRow>
  /** The entries that look like rows the AI copied, answered or not, in the statement's order. */
  readonly questions: readonly CopiedTwinQuestion[]
}

/**
 * A copied statement's references are its own, so its entries are matched against the account's ledger rows too. One of the same
 * day, amount and counterparty as a row is on the ledger. One that only looks like a row waits unless the person said to import
 * it. A statement Kuna read itself is matched the same way against the rows the AI copied. One that only looks like a copied row
 * counts as on the ledger until the person says to keep both. `inLedger` says which entries the account's references hold already.
 */
export function copiedTwins(statement: ImportedStatement, accountRows: readonly Transaction[], inLedger: readonly boolean[], twinAnswers: ReadonlyMap<string, TwinAnswer>): CopiedTwins {
  const { source, account } = statement
  const found = [...inLedger]
  const likeOf = new Map<ImportedRow, Transaction>()
  const copiedTwinOf = new Map<ImportedRow, Transaction>()
  const twinOnLedger = new Map<Transaction, ImportedRow>()
  const questions: CopiedTwinQuestion[] = []
  const hit = new Set(statement.rows.filter((_, index) => inLedger[index]).map((row) => row.reference))
  const fromOtherSource = (row: Transaction): boolean => (source.kind === 'transcribed' ? true : isTranscribedReference(row.reference))
  const others = accountRows.filter((row) => fromOtherSource(row) && !hit.has(row.reference) && row.statement !== statement.label)
  for (const [row, twin] of bookedTwins(
    statement.rows.filter((_, index) => !inLedger[index]),
    others,
  )) {
    const index = statement.rows.indexOf(row)
    if (twin.kind === 'same') {
      found[index] = true
      if (source.kind !== 'transcribed') twinOnLedger.set(twin.booked, row)
    } else if (source.kind === 'transcribed') {
      if (source.lookAlikes === 'ask') likeOf.set(row, twin.booked)
    } else {
      const key = copiedTwinKey(account, row)
      const answer = twinAnswers.get(key)
      const keep = answer?.booked === twin.booked.id ? answer.keep : null
      questions.push({ key, row, copied: twin.booked, keep })
      copiedTwinOf.set(row, twin.booked)
      if (keep === 'both') continue
      found[index] = true
      twinOnLedger.set(twin.booked, row)
    }
  }
  questions.sort((left, right) => statement.rows.indexOf(left.row) - statement.rows.indexOf(right.row))
  return { inLedger: found, likeOf, copiedTwinOf, twinOnLedger, questions }
}
