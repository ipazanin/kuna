import { isCompleteMonth } from '../../../shared/calendar/ledgerWindow'
import type { LedgerWindow } from '../../../shared/calendar/ledgerWindow'
import { monthOf } from '../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../shared/calendar/monthKey'
import { ZERO, addMoney, negateMoney, ratioOf, sumMoney } from '../../../shared/money/money'
import type { Money } from '../../../shared/money/money'
import { directionOf } from '../../workbook/domain/bucket'
import type { Bucket } from '../../workbook/domain/bucket'
import { bucketTotals } from '../../workbook/domain/bucketTotals'
import { counterpartyIdentity } from '../../workbook/domain/counterpartyIdentity'
import type { Transaction } from '../../workbook/domain/workbook'

export type Grouping = 'none' | 'month' | 'category' | 'counterparty'

/**
 * A group's part of the selection on its own side. A category counts against all income or all
 * costs, as every share in the app does. A counterparty counts against all money in or all money out.
 */
export interface GroupShare {
  readonly of: 'income' | 'cost' | 'money-in' | 'money-out'
  readonly fraction: number
}

interface GroupMembers {
  /** Unique within one grouping, so a collapsed group is remembered by it. */
  readonly key: string
  /** In the order the rows were given. */
  readonly rows: readonly Transaction[]
  readonly total: Money
}

export interface CategoryGroup extends GroupMembers {
  readonly kind: 'category'
  /** Empty for rows with no category. */
  readonly category: string
  readonly bucket: Bucket
  /** Null for financing, neutral and unclassified rows, and when the side's total is zero. */
  readonly share: GroupShare | null
}

export interface MonthGroup extends GroupMembers {
  readonly kind: 'month'
  readonly month: MonthKey
  readonly income: Money
  /** Reads positive, as costs do everywhere else. */
  readonly cost: Money
  readonly net: Money
  /** The ledger's newest month is still filling up, and its first may have started late. */
  readonly coverage: 'complete' | 'month-so-far' | 'part-month'
}

export interface CounterpartyGroup extends GroupMembers {
  readonly kind: 'counterparty'
  readonly label: string
  /** Empty when the counterparty is known by name only. */
  readonly iban: string
  readonly share: GroupShare | null
}

export type TransactionGroup = CategoryGroup | MonthGroup | CounterpartyGroup

export interface GroupingContext {
  readonly window: LedgerWindow
  /** The label of every counterparty key, from the whole ledger so a label does not change with the filters. */
  readonly counterpartyLabels: ReadonlyMap<string, string>
}

/**
 * The rows split into groups that keep the rows' order. Months come newest first. Categories and
 * counterparties come largest first by the size of their total, whichever its sign.
 */
export function groupTransactions(
  rows: readonly Transaction[],
  grouping: Exclude<Grouping, 'none'>,
  context: GroupingContext,
): TransactionGroup[] {
  switch (grouping) {
    case 'month':
      return monthGroups(rows, context.window)
    case 'category':
      return categoryGroups(rows)
    case 'counterparty':
      return counterpartyGroups(rows, context.counterpartyLabels)
  }
}

function monthGroups(rows: readonly Transaction[], window: LedgerWindow): MonthGroup[] {
  return [...partition(rows, (transaction) => monthOf(transaction.date))]
    .map(([month, members]): MonthGroup => {
      const profitAndLoss = bucketTotals(members)
      return {
        kind: 'month',
        key: month,
        rows: members,
        total: totalOf(members),
        month,
        income: profitAndLoss.income,
        cost: profitAndLoss.cost,
        net: profitAndLoss.net,
        coverage: isCompleteMonth(window, month) ? 'complete' : month === window.partMonth ? 'month-so-far' : 'part-month',
      }
    })
    .sort((left, right) => right.month.localeCompare(left.month))
}

function categoryGroups(rows: readonly Transaction[]): CategoryGroup[] {
  const profitAndLoss = bucketTotals(rows)
  return largestFirst(
    [...partition(rows, (transaction) => transaction.category)].map(([category, members]): CategoryGroup => {
      const total = totalOf(members)
      const bucket = members[0].bucket
      const direction = directionOf(bucket)
      const fraction =
        direction === 'income' ? ratioOf(total, profitAndLoss.income) : direction === 'cost' ? ratioOf(negateMoney(total), profitAndLoss.cost) : null
      return {
        kind: 'category',
        key: category,
        rows: members,
        total,
        category,
        bucket,
        share: direction === null || fraction === null ? null : { of: direction, fraction },
      }
    }),
    (group) => group.category,
  )
}

function counterpartyGroups(rows: readonly Transaction[], labels: ReadonlyMap<string, string>): CounterpartyGroup[] {
  const groups = [...partition(rows, (transaction) => counterpartyIdentity(transaction).key)].map(([key, members]) => ({
    key,
    members,
    total: totalOf(members),
  }))
  let moneyIn = ZERO
  let moneyOut = ZERO
  for (const group of groups) {
    if (group.total > 0) moneyIn = addMoney(moneyIn, group.total)
    if (group.total < 0) moneyOut = addMoney(moneyOut, negateMoney(group.total))
  }
  return largestFirst(
    groups.map(({ key, members, total }): CounterpartyGroup => ({
      kind: 'counterparty',
      key,
      rows: members,
      total,
      label: labels.get(key) ?? '',
      iban: members[0].counterpartyIban,
      share:
        total > 0
          ? { of: 'money-in', fraction: total / moneyIn }
          : total < 0
            ? { of: 'money-out', fraction: -total / moneyOut }
            : null,
    })),
    (group) => group.label,
  )
}

function partition<Key>(rows: readonly Transaction[], keyOf: (transaction: Transaction) => Key): Map<Key, Transaction[]> {
  const groups = new Map<Key, Transaction[]>()
  for (const transaction of rows) {
    const key = keyOf(transaction)
    const members = groups.get(key)
    if (members === undefined) {
      groups.set(key, [transaction])
    } else {
      members.push(transaction)
    }
  }
  return groups
}

function totalOf(rows: readonly Transaction[]): Money {
  return sumMoney(rows.map((transaction) => transaction.amount))
}

function largestFirst<Group extends GroupMembers>(groups: Group[], labelOf: (group: Group) => string): Group[] {
  return groups.sort((left, right) => Math.abs(right.total) - Math.abs(left.total) || labelOf(left).localeCompare(labelOf(right)))
}
