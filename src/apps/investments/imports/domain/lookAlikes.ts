import type { LikelyAccount } from './importQuestions'
import type { ImportedRecord } from './importedRecords'
import { accountScopeOf, isAskedKey, isReportKey, isWorkbookKey } from './reportKey'
import type { RowEntry } from './workbookEntries'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import { roundedDecimal } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** A record a row may be taken for, by its id and the keys it holds. */
type OfferedRecord = { readonly id: RecordId; readonly importKeys: readonly string[] }

/**
 * Whether a workbook row may ask of the record: only one that holds a report's or a copied row's key and no workbook key,
 * since a report's Same record once took the workbook's key from it. Same record then gives the key back.
 */
export function lostWorkbookKey(record: OfferedRecord): boolean {
  return record.importKeys.length > 0 && !record.importKeys.some(isWorkbookKey)
}

const CENT_PLACES = 2

/**
 * Whether two amounts are the same. One given to the cent is the same as the other rounded to the cent, since a record
 * typed by hand or imported before Kuna kept a report's fractions holds cents where the report holds more.
 */
export function sameAmount(one: Decimal, other: Decimal): boolean {
  const inCents = (amount: Decimal): boolean => roundedDecimal(amount, CENT_PLACES) === amount
  return one === other || (inCents(one) && roundedDecimal(other, CENT_PLACES) === one) || (inCents(other) && roundedDecimal(one, CENT_PLACES) === other)
}

/**
 * The record Kuna has that it looks like, or null: a trade of the same holding, day, side and units, income of the same
 * holding, day and gross, a cash movement of the same day, kind, currency and amount, or an exchange of the same day and
 * both amounts, each amount the same by `sameAmount`. Each in the same account, or in any account when the record's
 * account is new, since a new account has nothing to compare. Only a record `offered` lets through counts.
 */
export function recordLike(imported: ImportedRecord, book: InvestmentBook, offered: (record: OfferedRecord) => boolean): ImportedRecord | null {
  const newAccount = (account: RecordId): boolean => !book.accounts.some((known) => known.id === account)
  const sameAccount = (record: OfferedRecord & { readonly account: RecordId }, account: RecordId): boolean => offered(record) && (newAccount(account) || record.account === account)
  switch (imported.kind) {
    case 'trade': {
      const { account, instrument, date, side, quantity } = imported.record
      const like = book.trades.find((trade) => sameAccount(trade, account) && trade.instrument === instrument && trade.date === date && trade.side === side && trade.quantity === quantity)
      return like === undefined ? null : { kind: 'trade', record: like }
    }
    case 'income': {
      const { account, instrument, date, currency, gross } = imported.record
      const like = book.income.find(
        (income) => sameAccount(income, account) && income.instrument === instrument && income.date === date && income.currency === currency && sameAmount(income.gross, gross),
      )
      return like === undefined ? null : { kind: 'income', record: like }
    }
    case 'cash-movement': {
      const { account, kind, date, currency, amount } = imported.record
      const like = book.cashMovements.find(
        (movement) => sameAccount(movement, account) && movement.kind === kind && movement.date === date && movement.currency === currency && sameAmount(movement.amount, amount),
      )
      return like === undefined ? null : { kind: 'cash-movement', record: like }
    }
    case 'exchange': {
      const { account, date, sold, soldCurrency, bought, boughtCurrency } = imported.record
      const like = book.exchanges.find(
        (exchange) =>
          sameAccount(exchange, account) &&
          exchange.date === date &&
          sameAmount(exchange.sold, sold) &&
          exchange.soldCurrency === soldCurrency &&
          sameAmount(exchange.bought, bought) &&
          exchange.boughtCurrency === boughtCurrency,
      )
      return like === undefined ? null : { kind: 'exchange', record: like }
    }
    default:
      return null
  }
}

/**
 * Which records a row may look like: none another row of the file already looks like, and for a report's row none an
 * earlier report of the same account made, since a report gives each of its rows an id of its own.
 */
export function lookAlikesOffered(keyed: ReadonlyMap<string, ImportedRecord>, rolling: boolean): (entry: RowEntry, claimed: ReadonlySet<RecordId>) => (record: OfferedRecord) => boolean {
  const reportScopes = new Map(rolling ? [...keyed].flatMap(([key, imported]) => (isReportKey(key) && !isAskedKey(key) ? [[imported.record.id, accountScopeOf(key)] as const] : [])) : [])
  return (entry, claimed) => (record) => !claimed.has(record.id) && reportScopes.get(record.id) !== accountScopeOf(entry.key)
}

/**
 * For each account of a report that no earlier import names, the account in Kuna with the most records its rows look
 * like, Kuna's first account of those on a tie. None when no row looks like a record. `inAnyAccount` makes a row's
 * record as if its account held no record yet, or null for a row that cannot make one.
 */
export function likelyAccounts(
  entries: readonly RowEntry[],
  book: InvestmentBook,
  known: ReadonlyMap<string, RecordId>,
  offered: ReturnType<typeof lookAlikesOffered>,
  inAnyAccount: (entry: RowEntry) => ImportedRecord | null,
): Map<string, LikelyAccount> {
  const claimed = new Set<RecordId>()
  const votes = new Map<string, Map<RecordId, number>>()
  for (const entry of entries) {
    const text = entry.rows[0].account
    if (known.has(text)) continue
    const made = inAnyAccount(entry)
    const like = made === null ? null : recordLike(made, book, offered(entry, claimed))
    if (like === null || !('account' in like.record)) continue
    claimed.add(like.record.id)
    const counts = votes.get(text) ?? new Map<RecordId, number>()
    counts.set(like.record.account, (counts.get(like.record.account) ?? 0) + 1)
    votes.set(text, counts)
  }
  return new Map(
    [...votes].map(([text, counts]) => {
      const rows = Math.max(...counts.values())
      const account = book.accounts.find((candidate) => counts.get(candidate.id) === rows)!.id
      return [text, { account, rows }] as const
    }),
  )
}
