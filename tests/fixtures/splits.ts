import { moneyFromAmount } from '../../src/shared/money/money'
import { splitLedger } from '../../src/features/workbook/domain/splits'
import type { LedgerSplit } from '../../src/features/workbook/domain/splits'
import type { Category, Transaction } from '../../src/features/workbook/domain/workbook'
import { recordIdOf } from '../../src/features/workbook/domain/recordId'
import { SPLIT_PART_RECORDS } from '../../src/features/workbook/domain/recordKind'

/** A split of one row into parts given in euros with their categories, each part on its own row of the splits tab from row 2. */
export function splitOf(row: Transaction, parts: readonly (readonly [amount: number, category: string, note?: string])[], categories: readonly Category[]): LedgerSplit {
  return {
    row,
    parts: parts.map(([amount, category, note = ''], index) => {
      const defined = categories.find((candidate) => candidate.slug === category)!
      return { amount: moneyFromAmount(amount), category, family: defined.family, bucket: defined.bucket, note, ownerShare: null, id: recordIdOf(SPLIT_PART_RECORDS, `split-${index + 2}`) }
    }),
  }
}

/** The rows with the one on the given day and amount split into these parts, as the screens count it. */
export function withSplit(
  transactions: readonly Transaction[],
  on: { readonly date: string; readonly amount: number },
  parts: readonly (readonly [amount: number, category: string, note?: string])[],
  categories: readonly Category[],
): readonly Transaction[] {
  const row = transactions.find((candidate) => candidate.date === on.date && candidate.amount === moneyFromAmount(on.amount))!
  return splitLedger(transactions, [splitOf(row, parts, categories)])
}
