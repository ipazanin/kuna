import { ruleVerdicts, spendingCategorisationContext } from './spendingCategorisation'
import type { RowChange } from './spendingCategorisation'
import type { StatementRow, StatementRows } from './statementRows'
import { words } from './words'
import { sameMoney } from '../../pairing/domain/sameMoney'
import { wantsSavingsAccount } from '../../pairing/domain/wantsSavingsAccount'
import { isPairable, legsOfPair, transferPairs } from '../../pairing/domain/transferPairs'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import { TRANSACTION_RECORDS } from '../../workbook/domain/spendingKinds'
import type { Transaction } from '../../workbook/domain/transaction'
import { addDays } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { normaliseIban } from '../../../../shared/text/fold'
import { plural } from '../../../../shared/text/translation'

/** How far before today and before the statement's oldest new row the pairing looks for the other leg among rows on the file. */
const PAIRING_DAYS = 30

/** What happens to a row: `before-opening` is left out, `already-in` skipped, `filled` joins a typed row, `new` is added, and `refiled` is a row already on the file that the pairing changes. */
export type DryRunOutcome = 'before-opening' | 'already-in' | 'filled' | 'new' | 'refiled'

export interface DryRunLine {
  readonly row: StatementRow
  readonly outcome: DryRunOutcome
  /** The category it ends up with, null while it waits on review. */
  readonly category: RecordId | null
}

/** What importing a statement would do, with nothing written yet. */
export interface StatementDryRun {
  readonly lines: readonly DryRunLine[]
  /** The rows to add. */
  readonly added: readonly Transaction[]
  /** The rows on the file that change: typed rows a bank row filled, and rows that became a transfer's leg. */
  readonly changed: readonly RowChange[]
  readonly newRows: number
  readonly alreadyIn: number
  readonly filled: number
  readonly notes: readonly string[]
}

/** The row that typed money becomes once the bank booked it. It keeps its id, category, note and your name for the payee. */
export function filledByBank(
  typed: Transaction,
  bank: Pick<Transaction, 'date' | 'amount' | 'payee' | 'description' | 'counterpartyIban' | 'importKey' | 'statement' | 'movedAt' | 'pocket'>,
): Transaction {
  return {
    ...typed,
    date: bank.date,
    amount: bank.amount,
    payee: typed.payee === '' ? bank.payee : typed.payee,
    description: bank.description,
    counterpartyIban: bank.counterpartyIban,
    importKey: bank.importKey,
    statement: bank.statement,
    movedAt: bank.movedAt,
    pocket: bank.pocket,
  }
}

/** The rows on the file you typed or a receipt made, which no bank row filled yet. */
export function typedRowsOf(book: Pick<SpendingBook, 'transactions'>): readonly Transaction[] {
  return book.transactions.filter((row) => row.source !== 'statement' && row.importKey === '')
}

/**
 * Works out a statement against the file, row by row: a row before its account opened is left out, as the entry dialog
 * refuses one, and a row whose key is on the account is skipped. Else a row of the same money as a typed row fills it, and
 * any other row is new, filed by the reader or the first rule that holds, or waiting on review. A row that moves money
 * between your accounts fills only a typed transfer leg, and a row the reader filed fills nothing. Then the new rows and the
 * unpaired rows from 30 days back are paired into transfers. `newKey` makes each new row's bare UUID.
 */
export function statementDryRun(book: SpendingBook, statement: StatementRows, day: CivilDate, newKey: () => string = newRecordId): StatementDryRun {
  const accounts = new Map(book.accounts.map((account) => [account.id, account]))
  const onFile = new Set(book.transactions.filter((row) => row.importKey !== '').map((row) => `${row.account} ${row.importKey}`))
  const beforeOpening = (row: StatementRow): boolean => row.date < (accounts.get(row.account)?.openedOn ?? row.date)
  const alreadyIn = (row: StatementRow): boolean => onFile.has(`${row.account} ${row.importKey}`)
  const coming = statement.rows.filter((row) => !beforeOpening(row) && !alreadyIn(row))

  const context = spendingCategorisationContext(book)
  const transfer = book.categories.find((category) => category.kind === 'transfer')?.id ?? null
  const movesOwnMoney = (row: StatementRow): boolean => row.movedAt !== '' || context.ownIbans.has(normaliseIban(row.counterpartyIban))
  const isTypedLeg = (typed: Transaction): boolean => typed.pair !== null || (transfer !== null && typed.category === transfer)
  const typedRows = typedRowsOf(book)
  const legsFilled = sameMoney(typedRows.filter(isTypedLeg), coming.filter(movesOwnMoney)).matches
  const legsTaken = new Set(legsFilled.map(({ typed }) => typed))
  const matches = [
    ...legsFilled,
    ...sameMoney(
      typedRows.filter((typed) => !legsTaken.has(typed)),
      coming.filter((row) => row.category === null && !movesOwnMoney(row)),
    ).matches,
  ]
  const typedOf = new Map(matches.map(({ typed, bank }) => [bank, typed]))
  const filledRows: RowChange[] = matches.map(({ typed, bank }) => ({ before: typed, after: filledByBank(typed, { ...bank, statement: statement.label }) }))

  const categoryByRule = ruleVerdicts(book.rules, book)
  const newRowOf = new Map<StatementRow, Transaction>(
    coming
      .filter((row) => !typedOf.has(row))
      .map((row) => {
        const byRule = row.category === null ? categoryByRule(row) : null
        return [
          row,
          {
            ...row,
            id: recordIdOf(TRANSACTION_RECORDS, newKey()),
            category: row.category ?? byRule,
            note: '',
            source: 'statement' as const,
            pair: null,
            statement: statement.label,
            categorisedBy: byRule === null ? null : ('rule' as const),
          },
        ]
      }),
  )

  const since = addDays([day, ...coming.map((row) => row.date)].sort()[0]!, -PAIRING_DAYS)
  const onFileToPair = book.transactions.filter((row) => row.date >= since && isPairable(row))
  const asTransfers = transfer === null ? new Map<Transaction, Transaction>() : transferred([...newRowOf.values(), ...onFileToPair], book, transfer)

  const added = [...newRowOf.values()].map((row) => asTransfers.get(row) ?? row)
  const pairedOnFile = onFileToPair.flatMap((before) => {
    const after = asTransfers.get(before)
    return after === undefined ? [] : [{ before, after }]
  })

  const fileLines = statement.rows.map((row): DryRunLine => {
    if (beforeOpening(row)) return { row, outcome: 'before-opening', category: null }
    if (alreadyIn(row)) return { row, outcome: 'already-in', category: null }
    const typed = typedOf.get(row)
    if (typed !== undefined) return { row, outcome: 'filled', category: typed.category }
    const fresh = newRowOf.get(row)!
    return { row, outcome: 'new', category: (asTransfers.get(fresh) ?? fresh).category }
  })
  const lines = [...fileLines, ...pairedOnFile.map(({ before, after }): DryRunLine => ({ row: before, outcome: 'refiled', category: after.category }))]
  const leftOut = lines.filter((line) => line.outcome === 'before-opening').length
  const wanting = added.filter((row) => wantsSavingsAccount(row, book.accounts)).length
  return {
    lines,
    added,
    changed: [...filledRows, ...pairedOnFile],
    newRows: added.length,
    alreadyIn: lines.filter((line) => line.outcome === 'already-in').length,
    filled: filledRows.length,
    notes: [...statement.notes, ...(leftOut === 0 ? [] : [plural(words.beforeOpeningLeftOut(leftOut), leftOut)]), ...(wanting === 0 ? [] : [plural(words.pocketsWaiting(wanting), wanting)])],
  }
}

/** Each row the pairing changes, as it becomes: a pair's leg, or a lone leg that counts as a transfer and waits. */
function transferred(rows: readonly Transaction[], book: Pick<SpendingBook, 'accounts'>, transfer: RecordId): ReadonlyMap<Transaction, Transaction> {
  const { pairs, waiting } = transferPairs(rows, book.accounts)
  const changes = new Map<Transaction, Transaction>()
  for (const { debit, credit } of pairs) {
    const [debitLeg, creditLeg] = legsOfPair(debit, credit, transfer)
    changes.set(debit, debitLeg)
    changes.set(credit, creditLeg)
  }
  for (const row of waiting) {
    if (row.category !== transfer) changes.set(row, { ...row, category: transfer, categorisedBy: null })
  }
  return changes
}
