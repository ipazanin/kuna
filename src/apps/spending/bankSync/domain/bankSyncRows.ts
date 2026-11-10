import type { BankTransaction } from './bankAnswer'
import { syncMoves } from '../../pairing/domain/syncMoves'
import { BANK_SYNC_KEY_PREFIX } from '../../statements/domain/statementRows'
import type { StatementRow } from '../../statements/domain/statementRows'
import type { Account } from '../../workbook/domain/account'
import { ibanKey } from '../../workbook/domain/accountReading'
import { parseCivilDate } from '../../../../shared/calendar/civilDate'
import { accountMoneyFromAmount, negateAccountMoney, sumAccountMoney, ZERO_ACCOUNT_MONEY } from '../../../../shared/money/accountMoney'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import { decimalOfText } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'
import { decimalOf } from '../../../../shared/storage/domain/storedFields'
import { occurrenceKeys } from '../../../../shared/text/factKey'

/** The label each row the sync brings carries. */
export const BANK_SYNC_LABEL = 'Enable Banking'

/** The statuses of money that may still book. Any other status but `BOOK`, such as a cancelled row, is no money at all and goes unmentioned. */
const PENDING_STATUSES: readonly string[] = ['PDNG', 'HOLD']

/** A row with any other direction might be money in or out, so it is not read as either. */
const KNOWN_DIRECTIONS: readonly string[] = ['CRDT', 'DBIT']

/** The rows of one account a sync read, and the exchange rate the bank gave on those that carry one. */
export interface SyncedRows {
  readonly label: string
  readonly rows: readonly StatementRow[]
  readonly exchangeRates: ReadonlyMap<StatementRow, Decimal>
  readonly leftOut: LeftOutRows
}

/** How many rows of the answer a sync did not read, by why. */
export interface LeftOutRows {
  /** Rows that may still book or change, which come with a later sync. */
  readonly pending: number
  /** Rows of no amount, since an entry is never zero. */
  readonly zero: number
  /** Rows whose day or amount cannot be read. */
  readonly unreadable: number
}

/** What a row would be, before its key. */
type KeylessRow = Omit<StatementRow, 'importKey'>

/** The transaction's money, below zero when it goes out. Null when its amount or direction cannot be read. */
function signedAmountOf(transaction: BankTransaction): AccountMoney | null {
  const number = decimalOf(transaction.amount)
  if (number === null || !KNOWN_DIRECTIONS.includes(transaction.direction)) return null
  const money = accountMoneyFromAmount(Math.abs(number))
  return transaction.direction === 'DBIT' ? negateAccountMoney(money) : money
}

function rowOf(transaction: BankTransaction, account: Account): KeylessRow | null {
  const date = parseCivilDate((transaction.madeOn ?? transaction.bookedOn ?? transaction.valueOn ?? '').slice(0, 10))
  const amount = signedAmountOf(transaction)
  if (date === null || amount === null) return null
  const out = transaction.direction === 'DBIT'
  const description = transaction.remittance.join(' ').trim()
  return {
    account: account.id,
    date,
    amount,
    payee: (out ? transaction.creditorName : transaction.debtorName) ?? description,
    category: null,
    description,
    counterpartyIban: ibanKey((out ? transaction.creditorIban : transaction.debtorIban) ?? ''),
    movedAt: '',
    pocket: false,
    cashWithdrawal: false,
  }
}

/**
 * The facts that name a row: the bank's own reference with its day and amount, since some banks repeat a reference on other
 * money and a later fetch may see only one of them, or for a bank that gives none, what the row says.
 */
function keyFacts(transaction: BankTransaction, row: KeylessRow): readonly string[] {
  const reference = transaction.reference?.trim() ?? ''
  return reference === '' ? [row.date, String(row.amount), row.payee, row.description] : [reference, row.date, String(row.amount)]
}

/**
 * The booked transactions in the account's currency as statement rows on the account. A pending one may still change or go
 * away, so it is left out and counted, as in Revolut's files, and comes with a later sync once booked. One of no amount is
 * left out too, since an entry is never zero, and so is one whose day or amount cannot be read, so that one row the bank
 * keeps sending never stops the rest.
 */
export function bankSyncRows(answer: readonly BankTransaction[], account: Account): SyncedRows {
  const inCurrency = answer.filter((transaction) => transaction.currency === account.currency)
  const booked = inCurrency.filter((transaction) => transaction.status === 'BOOK')
  const pending = inCurrency.filter((transaction) => PENDING_STATUSES.includes(transaction.status)).length
  const read = booked.flatMap((transaction) => {
    const row = rowOf(transaction, account)
    return row === null ? [] : [{ transaction, row }]
  })
  const withMoney = read.filter(({ row }) => row.amount !== ZERO_ACCOUNT_MONEY)
  const keys = occurrenceKeys(withMoney.map(({ transaction, row }) => keyFacts(transaction, row)))
  const unreadable = booked.length - read.length
  const zero = read.length - withMoney.length
  const keyed = withMoney.map(({ transaction, row }, place) => ({ transaction, row: { ...row, importKey: `${BANK_SYNC_KEY_PREFIX}${keys[place]!}` } }))
  return {
    label: BANK_SYNC_LABEL,
    rows: keyed.map(({ row }) => row),
    exchangeRates: new Map(
      keyed.flatMap(({ transaction, row }) => {
        const rate = exchangeRateOf(transaction)
        return rate === null ? [] : [[row, rate] as const]
      }),
    ),
    leftOut: { pending, zero, unreadable },
  }
}

/**
 * What the answer's rows in the currency that may still book add up to, which a bank's balance may already count. Null when
 * it holds none. A row whose amount cannot be read adds nothing.
 */
export function pendingMoney(answer: readonly BankTransaction[], currency: string): AccountMoney | null {
  const pending = answer.filter((transaction) => transaction.currency === currency && PENDING_STATUSES.includes(transaction.status))
  if (pending.length === 0) return null
  return sumAccountMoney(pending.flatMap((transaction) => signedAmountOf(transaction) ?? []))
}

/** The bank's exchange rate as a plain multiplier, so `0.8` is 0.8. Null when it gives none, or one that is not above zero. */
function exchangeRateOf(transaction: BankTransaction): Decimal | null {
  const rate = decimalOfText(transaction.exchangeRate?.trim() ?? '')
  return rate === null || rate <= 0n ? null : rate
}

/**
 * A fetch's rows with the two legs of each exchange and pocket move sharing a key in `movedAt`, as a file's legs share the
 * time they started, so the transfer pairing pairs both alike. The key is the two legs' import keys.
 */
export function rowsWithMoves(rows: readonly StatementRow[], exchangeRates: ReadonlyMap<StatementRow, Decimal>, accounts: readonly Account[]): readonly StatementRow[] {
  const { exchanges, pocketMoves } = syncMoves(rows, accounts, (row) => exchangeRates.get(row) ?? null)
  const moves = [...exchanges.map((legs) => ({ ...legs, pocket: false })), ...pocketMoves.map((legs) => ({ ...legs, pocket: true }))]
  const moved = new Map<StatementRow, Pick<StatementRow, 'movedAt' | 'pocket'>>(
    moves.flatMap(({ debit, credit, pocket }) => {
      const movedAt = `${debit.importKey} ${credit.importKey}`
      return [
        [debit, { movedAt, pocket }],
        [credit, { movedAt, pocket }],
      ]
    }),
  )
  return rows.map((row) => ({ ...row, ...moved.get(row) }))
}
