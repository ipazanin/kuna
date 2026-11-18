import type { CashMovement } from '../../workbook/domain/cashMovement'
import type { Exchange } from '../../workbook/domain/exchange'
import type { Income } from '../../workbook/domain/income'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import type { SpinOff } from '../../workbook/domain/spinOff'
import type { Split } from '../../workbook/domain/split'
import type { Trade } from '../../workbook/domain/trade'
import type { Transfer } from '../../workbook/domain/transfer'

/** A record of a kind an import writes, with its kind. */
export type ImportedRecord =
  | { readonly kind: 'trade'; readonly record: Trade }
  | { readonly kind: 'income'; readonly record: Income }
  | { readonly kind: 'cash-movement'; readonly record: CashMovement }
  | { readonly kind: 'exchange'; readonly record: Exchange }
  | { readonly kind: 'transfer'; readonly record: Transfer }
  | { readonly kind: 'split'; readonly record: Split }
  | { readonly kind: 'spin-off'; readonly record: SpinOff }

/** Every record of the kinds an import writes, each with its kind. */
export function importableRecords(book: InvestmentBook): ImportedRecord[] {
  return [
    ...book.trades.map((record) => ({ kind: 'trade', record }) as const),
    ...book.income.map((record) => ({ kind: 'income', record }) as const),
    ...book.cashMovements.map((record) => ({ kind: 'cash-movement', record }) as const),
    ...book.exchanges.map((record) => ({ kind: 'exchange', record }) as const),
    ...book.transfers.map((record) => ({ kind: 'transfer', record }) as const),
    ...book.splits.map((record) => ({ kind: 'split', record }) as const),
    ...book.spinOffs.map((record) => ({ kind: 'spin-off', record }) as const),
  ]
}
