import { withRuleLabels } from './spendingCategorisation'
import type { RowChange } from './spendingCategorisation'
import { rowSource } from './statementRows'
import type { StatementRow, StatementRows } from './statementRows'
import { itemsAtBankAmount } from '../../entries/domain/entrySplit'
import { refiledItems, waitsOnReview } from '../../workbook/domain/rowItems'
import { rowKey } from '../../workbook/domain/transaction'
import type { Transaction } from '../../workbook/domain/transaction'
import type { TransactionItem } from '../../workbook/domain/transactionItem'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { rangeContains } from '../../../../shared/calendar/dateRange'
import { inWindow, matchMoney } from '../../../../shared/app/moneyMatch'
import { fold } from '../../../../shared/text/fold'

/** The row a row Kuna holds, typed money or a payment the bank had not booked, becomes once the bank's row comes. It keeps its id, its items and your name for the payee. */
export function filledByBank(
  typed: Transaction,
  bank: Pick<Transaction, 'date' | 'amount' | 'payee' | 'description' | 'counterpartyIban' | 'importKey' | 'statement' | 'movedAt' | 'pocket' | 'cashWithdrawal' | 'pending'>,
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
    cashWithdrawal: bank.cashWithdrawal,
    pending: bank.pending,
  }
}

/** A row the bank had not booked, which a row of the statement books, and the row it becomes with its items. */
export interface BookedRow {
  readonly row: StatementRow
  readonly change: RowChange & { readonly items: readonly TransactionItem[] }
}

/** What a statement does to the rows on the file the bank had not booked yet. */
export interface PendingBooking {
  readonly booked: readonly BookedRow[]
  /** Rows the bank had not booked that it no longer lists on days the statement saw whole. */
  readonly gone: readonly Transaction[]
  /** The other legs of transfers a gone row was a leg of, each a lone leg again. */
  readonly unpaired: readonly RowChange[]
}

/** What the booking reads besides the statement. */
export interface BookingPlace {
  readonly itemsOf: (row: Transaction) => readonly TransactionItem[]
  /** How the rules file a row that waits on review once it is booked, as they would a new row, or null when none files it. */
  readonly filing: (row: Transaction) => { readonly category: RecordId | null; readonly labels: readonly RecordId[] }
  /** The words of a Difference part. */
  readonly difference: string
  readonly newKey: () => string
}

/** Whether two rows name the same other side: the same payee, the same bank text or the same IBAN, read without accents or case. */
function samePayee(held: Transaction, row: StatementRow): boolean {
  const same = (one: string, other: string): boolean => one !== '' && fold(one) === fold(other)
  return same(held.payee, row.payee) || same(held.description, row.description) || same(held.counterpartyIban, row.counterpartyIban)
}

/** Whether a person renamed the payee: it is not blank and not the bank's text, which a row with no name of the other side starts with. */
function renamedPayee(held: Transaction): boolean {
  return held.payee !== '' && held.payee !== held.description
}

/**
 * The booked row a row the bank had not booked becomes, with its items. Its day, amount and the bank's facts become the booked
 * row's, and its payee follows the bank unless a person renamed it. Its filing, labels, link, note, event and pair stay, and a
 * split gains a Difference part when the amount moved. A row that still waits on review is filed by the rules again on its
 * booked facts, as a new row would be.
 */
function bookedRowOf(held: Transaction, row: StatementRow, label: string, place: BookingPlace): RowChange & { readonly items: readonly TransactionItem[] } {
  const filled = { ...filledByBank(held, { ...row, statement: label }), payee: renamedPayee(held) ? held.payee : row.payee }
  const atAmount = filled.amount === held.amount ? place.itemsOf(held) : itemsAtBankAmount(place.itemsOf(held), filled.amount, place.difference, place.newKey)
  const [only] = atAmount
  if (only === undefined || atAmount.length > 1 || !waitsOnReview(atAmount) || held.categorisedBy !== null) return { before: held, after: filled, items: atAmount }
  const { category, labels } = place.filing(filled)
  const items = refiledItems([withRuleLabels(only, labels)], category)
  return { before: held, after: { ...filled, categorisedBy: category === null ? null : 'rule' }, items }
}

/**
 * Books the rows on the file the bank had not booked yet against a statement's rows that are not on the file. Only rows of the
 * statement's own source take part, the bank sync's or a file's, so a statement with no rows books nothing. A row whose key
 * the statement brings again stays as it is. Each other such row on an account the statement reads takes, in the file's order,
 * the nearest row of exactly its amount from 3 days before its day to 7 after, then the nearest of any amount the same way
 * from the same payee in those days, each row once, so a second payment at one shop takes a hold's place only when no exact
 * amount is left for it. A row the bank booked or listed anew takes its place as `bookedRowOf` says. A row no row took, on a day
 * the statement saw whole for its account, is gone, and the other leg of its transfer is a lone leg again.
 */
export function pendingBooking(rows: readonly Transaction[], incoming: readonly StatementRow[], statement: Pick<StatementRows, 'label' | 'rows' | 'covers'>, place: BookingPlace): PendingBooking {
  const keysHit = new Set(statement.rows.map(rowKey))
  const accounts = new Set([...statement.rows.map((row) => row.account), ...(statement.covers?.keys() ?? [])])
  const [first] = statement.rows
  const source = first === undefined ? null : rowSource(first.importKey)
  const held = rows.filter((row) => row.pending && rowSource(row.importKey) === source && accounts.has(row.account) && !keysHit.has(rowKey(row)))
  const matches = matchMoney(held, incoming, {
    mayBe: (waiting, row) => row.account === waiting.account,
    near: (waiting, row) => waiting.amount < 0 === row.amount < 0 && inWindow(waiting, row) && samePayee(waiting, row),
  })
  const booked = matches.map(({ expected, row }): BookedRow => ({ row, change: bookedRowOf(expected, row, statement.label, place) }))
  const taken = new Set(matches.map(({ expected }) => expected))
  const gone = held.filter((row) => {
    const seen = statement.covers?.get(row.account)
    return !taken.has(row) && seen !== undefined && rangeContains(seen, row.date)
  })
  const goneIds = new Set(gone.map((row) => row.id))
  const bookedAfter = new Map(booked.map(({ change }) => [change.before.id, change.after]))
  const unpaired = rows.flatMap((row): RowChange[] => {
    if (row.pair === null || !goneIds.has(row.pair) || goneIds.has(row.id) || bookedAfter.has(row.id)) return []
    return [{ before: row, after: { ...row, pair: null } }]
  })
  return {
    booked: booked.map((entry) =>
      entry.change.after.pair !== null && goneIds.has(entry.change.after.pair) ? { ...entry, change: { ...entry.change, after: { ...entry.change.after, pair: null } } } : entry,
    ),
    gone,
    unpaired,
  }
}
