import { absMoney } from '../../../../shared/money/money'
import type { Transaction } from '../../workbook/domain/workbook'

/** The newest rows as the bank booked them, by booking order across accounts, newest first. A split or shared row stays whole. */
export function latestBooked(booked: readonly Transaction[], count: number): Transaction[] {
  return [...booked].sort((first, second) => second.sequence - first.sequence).slice(0, count)
}

/** The row Transactions lists for a row as booked: the row itself, or its largest part where the screens count it as parts. Null when the counted rows leave it out. */
export function countedRowOf(booked: Transaction, counted: readonly Transaction[]): Transaction | null {
  return counted.filter((row) => row.id === booked.id).reduce<Transaction | null>((largest, row) => (largest === null || absMoney(row.amount) > absMoney(largest.amount) ? row : largest), null)
}
