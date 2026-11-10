import { ruleVerdicts, spendingCategorisationContext } from './spendingCategorisation'
import type { RowChange } from './spendingCategorisation'
import { isBankSyncKey, isTranscribedKey } from './statementRows'
import type { StatementRow, StatementRows } from './statementRows'
import { words } from './words'
import { sameMoney, typedRowsOf } from '../../pairing/domain/sameMoney'
import { wantsSavingsAccount } from '../../pairing/domain/wantsSavingsAccount'
import { isPairable, legsOfPair, transferPairs } from '../../pairing/domain/transferPairs'
import type { Account } from '../../workbook/domain/account'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import { TRANSACTION_RECORDS } from '../../workbook/domain/spendingKinds'
import type { Transaction } from '../../workbook/domain/transaction'
import { addDays } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { BOOKING_DAYS_APART, bookedTwins } from '../../../../shared/money/lookAlikeBookings'
import type { BookedTwin, Booking } from '../../../../shared/money/lookAlikeBookings'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { normaliseIban } from '../../../../shared/text/fold'
import { plural } from '../../../../shared/text/translation'

/** How far before today and before the statement's oldest new row the pairing looks for the other leg among rows on the file. */
const PAIRING_DAYS = 30

/**
 * What happens to a row: `before-opening` is left out, `already-in` skipped, `other-source` skipped since the other of a file and
 * the bank sync covers its day, `look-alike` waits since it looks like a row on the file from another source, `filled` joins a
 * typed row, `new` is added, and `refiled` is a row already on the file that the pairing changes.
 */
export type DryRunOutcome = 'before-opening' | 'already-in' | 'other-source' | 'look-alike' | 'filled' | 'new' | 'refiled'

export type DryRunLine =
  | {
      readonly row: StatementRow
      readonly outcome: Exclude<DryRunOutcome, 'look-alike'>
      /** The category it ends up with, null while it waits on review. */
      readonly category: RecordId | null
    }
  | {
      readonly row: StatementRow
      readonly outcome: 'look-alike'
      readonly category: null
      /** The row on the file it looks like. */
      readonly like: Transaction
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

/** Where an account's files end and its bank sync begins: the last day a file brought a row, and the first day the sync did. */
interface SourceDays {
  readonly lastFileDay: CivilDate | null
  readonly firstSyncDay: CivilDate | null
}

function sourceDaysOf(rows: readonly Pick<Transaction, 'account' | 'date' | 'importKey'>[]): ReadonlyMap<RecordId, SourceDays> {
  const days = new Map<RecordId, SourceDays>()
  for (const { account, date, importKey } of rows) {
    if (importKey === '') continue
    const { lastFileDay, firstSyncDay } = days.get(account) ?? { lastFileDay: null, firstSyncDay: null }
    days.set(
      account,
      isBankSyncKey(importKey)
        ? { lastFileDay, firstSyncDay: firstSyncDay === null || date < firstSyncDay ? date : firstSyncDay }
        : { firstSyncDay, lastFileDay: lastFileDay === null || date > lastFileDay ? date : lastFileDay },
    )
  }
  return days
}

/** A row as the look-alike test reads it, with the payee as the other side, and the row it came from. */
export function bookingOf<Row extends Pick<Transaction, 'date' | 'amount' | 'payee' | 'description'>>(row: Row): Booking<AccountMoney> & { readonly row: Row } {
  return { date: row.date, amount: row.amount, counterparty: row.payee, description: row.description, row }
}

/**
 * Each row's twin among the rows on the file from another source, but for those the statement's own keys hit and those of the
 * statement itself, such as its other parts. A copied row looks among every row an import brought, and a file's row among the
 * rows the AI copied.
 */
function twinsOnFile(rows: readonly StatementRow[], book: SpendingBook, statement: StatementRows): ReadonlyMap<StatementRow, BookedTwin<Transaction>> {
  const keysHit = new Set(statement.rows.map((row) => `${row.account} ${row.importKey}`))
  const fromOtherSource = (row: Transaction): boolean => (statement.transcribed === undefined ? isTranscribedKey(row.importKey) : row.importKey !== '')
  const others = book.transactions.filter((row) => fromOtherSource(row) && row.statement !== statement.label && !keysHit.has(`${row.account} ${row.importKey}`))
  const twins = new Map<StatementRow, BookedTwin<Transaction>>()
  for (const account of new Set(rows.map((row) => row.account))) {
    const copied = rows.filter((row) => row.account === account).map(bookingOf)
    const onFile = others.filter((row) => row.account === account).map(bookingOf)
    for (const [{ row }, twin] of bookedTwins(copied, onFile)) twins.set(row, { kind: twin.kind, booked: twin.booked.row })
  }
  return twins
}

/** One note per account for the rows the other source's days left out. */
function otherSourceNotes(rows: readonly StatementRow[], days: ReadonlyMap<RecordId, SourceDays>, accounts: ReadonlyMap<RecordId, Account>): readonly string[] {
  return [...new Set(rows.map((row) => row.account))].map((account) => {
    const ofAccount = rows.filter((row) => row.account === account)
    const name = accounts.get(account)?.name ?? ''
    const { lastFileDay, firstSyncDay } = days.get(account)!
    const forms = isBankSyncKey(ofAccount[0]!.importKey) ? words.coveredByFile(ofAccount.length, name, dayLabel(lastFileDay!)) : words.coveredBySync(ofAccount.length, name, dayLabel(firstSyncDay!))
    return plural(forms, ofAccount.length)
  })
}

/**
 * Works out a statement against the file, row by row: a row before its account opened is left out, as the entry dialog
 * refuses one, and a row whose key is on the account is skipped. Each account's days belong to one source, so a bank sync
 * row on or before the last day a file covers is left out, and so is a file's row from the sync's first day on. The two
 * never match row by row, since a sync may date a row by its booking and hold a file's fee inside it. Else a row of the
 * same money as a typed row fills it, and any other row is new, filed by the reader or the first rule that holds, or waiting on review. A row near a typed row waits
 * whatever a rule says, since filing it would count that money twice until you noticed. A row that moves money
 * between your accounts fills only a typed transfer leg, and a row the reader filed fills nothing. Then the new rows and the
 * unpaired rows from 30 days back are paired into transfers. `newKey` makes each new row's bare UUID.
 *
 * Rows the AI copied off a statement carry keys no other source gives, so they are matched against the rows on the file from
 * another source instead, and no day belongs to a source for them. A row of the same day, amount and counterparty as one is
 * already in. A row that only looks like one waits, unless the person said to import it. A file's row is matched the same way
 * against the rows the AI copied, and one that only looks like one is left out with a note, as the screen asks nothing.
 */
export function statementDryRun(book: SpendingBook, statement: StatementRows, day: CivilDate, newKey: () => string = newRecordId): StatementDryRun {
  const accounts = new Map(book.accounts.map((account) => [account.id, account]))
  const onFile = new Set(book.transactions.filter((row) => row.importKey !== '').map((row) => `${row.account} ${row.importKey}`))
  const beforeOpening = (row: StatementRow): boolean => row.date < (accounts.get(row.account)?.openedOn ?? row.date)
  const alreadyIn = (row: StatementRow): boolean => onFile.has(`${row.account} ${row.importKey}`)
  const notOnFile = statement.rows.filter((row) => !beforeOpening(row) && !alreadyIn(row))
  const sourceDays = sourceDaysOf(book.transactions)
  const coveredByOtherSource = (row: StatementRow): boolean => {
    const { lastFileDay, firstSyncDay } = sourceDays.get(row.account) ?? { lastFileDay: null, firstSyncDay: null }
    return isBankSyncKey(row.importKey) ? lastFileDay !== null && row.date <= lastFileDay : firstSyncDay !== null && row.date >= firstSyncDay
  }
  const { transcribed } = statement
  const otherSource = new Set<StatementRow>(transcribed === undefined ? notOnFile.filter(coveredByOtherSource) : [])
  const toMatch = notOnFile.filter((row) => !otherSource.has(row) && (transcribed !== undefined || !isBankSyncKey(row.importKey)))
  const twins = twinsOnFile(toMatch, book, statement)
  const sameOnFile = new Set([...twins].flatMap(([row, twin]) => (twin.kind === 'same' ? [row] : [])))
  const lookAlikeOf = new Map(transcribed?.lookAlikes === 'import' ? [] : [...twins].flatMap(([row, twin]) => (twin.kind === 'like' ? [[row, twin.booked] as const] : [])))
  const coming = notOnFile.filter((row) => !otherSource.has(row) && !sameOnFile.has(row) && !lookAlikeOf.has(row))

  const context = spendingCategorisationContext(book)
  const transfer = book.categories.find((category) => category.kind === 'transfer')?.id ?? null
  const movesOwnMoney = (row: StatementRow): boolean => row.movedAt !== '' || context.ownIbans.has(normaliseIban(row.counterpartyIban))
  const isTypedLeg = (typed: Transaction): boolean => typed.pair !== null || (transfer !== null && typed.category === transfer)
  const typedRows = typedRowsOf(book)
  const legsFilled = sameMoney(typedRows.filter(isTypedLeg), coming.filter(movesOwnMoney)).matches
  const legsTaken = new Set(legsFilled.map(({ typed }) => typed))
  const sameMoneyAsTyped = sameMoney(
    typedRows.filter((typed) => !legsTaken.has(typed)),
    coming.filter((row) => row.category === null && !movesOwnMoney(row)),
  )
  const matches = [...legsFilled, ...sameMoneyAsTyped.matches]
  const nearTyped = new Set(sameMoneyAsTyped.near.map(({ bank }) => bank))
  const typedOf = new Map(matches.map(({ typed, bank }) => [bank, typed]))
  const filledRows: RowChange[] = matches.map(({ typed, bank }) => ({ before: typed, after: filledByBank(typed, { ...bank, statement: statement.label }) }))

  const categoryByRule = ruleVerdicts(book.rules, book)
  const newRowOf = new Map<StatementRow, Transaction>(
    coming
      .filter((row) => !typedOf.has(row))
      .map((row) => {
        const byRule = row.category === null && !nearTyped.has(row) ? categoryByRule(row) : null
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
    if (alreadyIn(row) || sameOnFile.has(row)) return { row, outcome: 'already-in', category: null }
    if (otherSource.has(row)) return { row, outcome: 'other-source', category: null }
    const like = lookAlikeOf.get(row)
    if (like !== undefined) return { row, outcome: 'look-alike', category: null, like }
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
    notes: [
      ...statement.notes,
      ...(leftOut === 0 ? [] : [plural(words.beforeOpeningLeftOut(leftOut), leftOut)]),
      ...(wanting === 0 ? [] : [plural(words.pocketsWaiting(wanting), wanting)]),
      ...otherSourceNotes([...otherSource], sourceDays, accounts),
      ...(transcribed !== undefined || lookAlikeOf.size === 0 ? [] : [plural(words.copiedLookAlikes(lookAlikeOf.size, BOOKING_DAYS_APART), lookAlikeOf.size)]),
    ],
  }
}

/** The file's rows as they stand once the dry run is written. */
export function rowsAfterDryRun(rows: readonly Transaction[], run: Pick<StatementDryRun, 'added' | 'changed'>): readonly Transaction[] {
  const changedTo = new Map(run.changed.map(({ before, after }) => [before, after]))
  return [...rows.map((row) => changedTo.get(row) ?? row), ...run.added]
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
