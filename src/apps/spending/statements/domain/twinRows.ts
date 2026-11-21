import { isBankSyncKey, rowSource } from './statementRows'
import type { StatementRow, StatementRows } from './statementRows'
import type { HeldBankRow } from '../../workbook/domain/heldBankRow'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import { HELD_ROW_RECORDS } from '../../workbook/domain/spendingKinds'
import { rowKey } from '../../workbook/domain/transaction'
import type { Transaction } from '../../workbook/domain/transaction'
import { bookedTwins } from '../../../../shared/money/lookAlikeBookings'
import type { BookedTwin, Booking, TwinAnswer } from '../../../../shared/money/lookAlikeBookings'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import { recordIdOf } from '../../../../shared/storage/domain/recordId'

/** A row of a file or the bank sync that looks like a row Kuna has from another source, and what the person said of it, null until they say. */
export interface TwinQuestion {
  /** The row's `rowKey`, which the answer goes under. */
  readonly key: string
  readonly row: StatementRow
  /** The row on the file from another source it looks like. */
  readonly booked: Transaction
  readonly keep: TwinAnswer['keep'] | null
}

/** What a row's twin on the file makes of it: it is in, it waits, it takes the twin's place, or the twin stays and takes its key. */
export type TwinOutcome = 'already-in' | 'look-alike' | 'replaced' | 'kept'

/** The statement's rows against their twins on the file, and the bank rows already on hold. */
export interface TwinRows {
  /** The rows that look like rows Kuna has from another source, answered or not, in the statement's order. */
  readonly questions: readonly TwinQuestion[]
  /** What a row's twin makes of it, or null for a row that comes in. */
  readonly outcomeOf: (row: StatementRow) => TwinOutcome | null
  /** The row on the file a row has as its twin. Only for a row that has one. */
  readonly twinOf: (row: StatementRow) => Transaction
  /** The row on the file a waiting row looks like: the one its hold names, or its twin. */
  readonly likeOf: (row: StatementRow) => Transaction
}

/** A row as the look-alike test reads it, with the payee as the other side, and the row it came from. */
export function bookingOf<Row extends Pick<Transaction, 'date' | 'amount' | 'payee' | 'description'>>(row: Row): Booking<AccountMoney> & { readonly row: Row } {
  return { date: row.date, amount: row.amount, counterparty: row.payee, description: row.description, row }
}

/**
 * Each row's twin among the rows on the file from another source, but for those the statement's own keys hit and those of the
 * statement itself, such as its other parts. A row that took the statement's words but kept the bank sync's key is still a twin. A copied row looks among every row an import brought, and a file's or a sync's row
 * among the rows of the other two sources. The rows are matched in order, so those given first take their twins first.
 */
function twinsOnFile(rows: readonly StatementRow[], book: SpendingBook, statement: StatementRows): ReadonlyMap<StatementRow, BookedTwin<Transaction>> {
  const keysHit = new Set(statement.rows.map(rowKey))
  // A row of this statement that kept the bank sync's key is no part of it, so it stays a twin to find.
  const ownParts = (row: Transaction): boolean => row.statement === statement.label && !isBankSyncKey(row.importKey)
  const others = book.transactions.filter((row) => row.importKey !== '' && !ownParts(row) && !keysHit.has(rowKey(row)))
  const twins = new Map<StatementRow, BookedTwin<Transaction>>()
  const sourceOfRow = (row: Pick<StatementRow, 'importKey'>) => (statement.transcribed !== undefined ? 'copied' : isBankSyncKey(row.importKey) ? 'sync' : 'file')
  for (const group of new Set(rows.map((row) => `${row.account} ${sourceOfRow(row)}`))) {
    const ofGroup = rows.filter((row) => `${row.account} ${sourceOfRow(row)}` === group)
    const { account } = ofGroup[0]!
    const source = sourceOfRow(ofGroup[0]!)
    const copied = ofGroup.map(bookingOf)
    const onFile = others.filter((row) => row.account === account && (source === 'copied' || rowSource(row.importKey) !== source)).map(bookingOf)
    for (const [{ row }, twin] of bookedTwins(copied, onFile)) twins.set(row, { kind: twin.kind, booked: twin.booked.row })
  }
  return twins
}

/**
 * The twins of the rows the other source's days leave out and of the rows to match, the first taking theirs first. A row to
 * match that looks like one asks the person, unless it is copied, already on hold or not booked yet, since a row the bank has
 * not booked changes its key when it books and an answer under that key would never be found again. A row on hold waits, an answered one
 * takes its twin's place or leaves it, a row of the same money is in, and a copied look-alike waits unless the person said
 * to import such rows.
 */
export function twinRowsOf(otherSource: readonly StatementRow[], toMatch: readonly StatementRow[], book: SpendingBook, statement: StatementRows): TwinRows {
  const { transcribed } = statement
  const heldByKey = new Map(book.held.map((held) => [rowKey(held), held]))
  const twins = twinsOnFile([...otherSource, ...toMatch], book, statement)
  const questions = toMatch.flatMap((row): TwinQuestion[] => {
    const twin = twins.get(row)
    if (transcribed !== undefined || twin?.kind !== 'like' || heldByKey.has(rowKey(row)) || row.pending) return []
    const answer = statement.twinAnswers?.get(rowKey(row))
    return [{ key: rowKey(row), row, booked: twin.booked, keep: answer?.booked === twin.booked.id ? answer.keep : null }]
  })
  const questionOf = new Map(questions.map((question) => [question.row, question]))
  const byTwin = (row: StatementRow): TwinOutcome | null => {
    const twin = twins.get(row)
    const question = questionOf.get(row)
    if (heldByKey.has(rowKey(row))) return 'look-alike'
    if (twin === undefined) return null
    if (question !== undefined) return question.keep === null ? 'look-alike' : question.keep === 'file' ? 'replaced' : question.keep === 'kept' ? 'kept' : null
    if (twin.kind === 'same') return 'already-in'
    return transcribed?.lookAlikes === 'import' ? null : 'look-alike'
  }
  const outcomes = new Map(toMatch.map((row) => [row, byTwin(row)]))
  const byId = new Map(book.transactions.map((row) => [row.id, row]))
  const twinOf = (row: StatementRow): Transaction => twins.get(row)!.booked
  return {
    questions,
    outcomeOf: (row) => outcomes.get(row) ?? null,
    twinOf,
    likeOf: (row) => {
      const onHold = heldByKey.get(rowKey(row))
      return (onHold === undefined ? undefined : byId.get(onHold.like)) ?? twinOf(row)
    },
  }
}

/** The sync's waiting rows not on hold yet, put on hold on To review with the row each looks like. */
export function heldRowsOf(waiting: readonly { readonly row: StatementRow; readonly like: Transaction }[], book: Pick<SpendingBook, 'held'>, newKey: () => string): readonly HeldBankRow[] {
  const heldKeys = new Set(book.held.map(rowKey))
  return waiting
    .filter(({ row }) => isBankSyncKey(row.importKey) && !heldKeys.has(rowKey(row)))
    .map(({ row, like }) => ({
      id: recordIdOf(HELD_ROW_RECORDS, newKey()),
      account: row.account,
      date: row.date,
      amount: row.amount,
      payee: row.payee,
      description: row.description,
      counterpartyIban: row.counterpartyIban,
      importKey: row.importKey,
      like: like.id,
    }))
}
