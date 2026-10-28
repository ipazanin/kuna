import { addDays } from '../../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../../shared/calendar/civilDate'
import type { LedgerWindow } from '../../../../../shared/calendar/ledgerWindow'
import { ZERO, subtractMoney } from '../../../../../shared/money/money'
import type { Money } from '../../../../../shared/money/money'
import { drillToTransactions } from '../../../filters/domain/drillTarget'
import type { DrillTarget, Figure } from '../../../filters/domain/drillTarget'
import { periodRange } from '../../../filters/domain/filterState'
import type { FilterState, Period } from '../../../filters/domain/filterState'
import type { Category, OwnerAdvance, Transaction } from '../../../workbook/domain/workbook'
import { advanceBookFilters, netOwed, ownerAdvances } from './ownerAdvances'
import type { NetOwed, OwnerAdvanceLine } from './ownerAdvances'
import { loanBookFilters, ownerLoans } from './ownerLoans'
import type { OwnerLoan } from './ownerLoans'

/** A balance on a day, with the rows up to that day, or no rows when nothing came before it. */
export interface Balance {
  readonly amount: Money
  readonly drill: DrillTarget | null
}

/** One side of who owes whom over a period: owed at its start, what was added and settled in it, and owed at its end. */
export interface PeriodBalance {
  readonly start: Balance
  /** Lent to the owner, or paid by the owner, in the period. */
  readonly added: Figure
  /** Repaid by the owner, or reimbursed to the owner, in the period. */
  readonly settled: Figure
  readonly end: Figure
}

/** Who owes whom over a period, the balances read from the books as they stood on its last day. */
export interface OwedInPeriod {
  /** The day the balances stand on: the period's last day, or the newest bank row or cost the owner paid when the period runs past it. */
  readonly on: CivilDate
  readonly net: NetOwed
  /** The reimbursements to the owner with no cost on file by `on`, which net owed counts as paid to the owner. */
  readonly unaccountedTotal: Money
  readonly loans: PeriodBalance
  /** Every loan with a balance at some point in the period, as it stood on `on`, oldest first. */
  readonly loanList: readonly OwnerLoan[]
  readonly openLoans: number
  readonly oldestOpenLoan: CivilDate | null
  readonly advances: PeriodBalance
  /** Every cost the owner paid that was owed at some point in the period, as it stood on `on`, oldest first. */
  readonly advanceList: readonly OwnerAdvanceLine[]
}

interface Books {
  readonly transactions: readonly Transaction[]
  readonly ownerAdvances: readonly OwnerAdvance[]
  readonly categories: readonly Category[]
}

/**
 * The loan book and the costs the owner paid, cut at the period's last day and run through the same
 * matching, so each loan and cost reads as it stood that day. A repayment after that day is not
 * known yet, so a loan can read open here and closed over the whole ledger. The flows are the
 * period's rows: what was lent or paid by the owner, and what came back.
 */
export function owedInPeriod(books: Books, period: Period, window: LedgerWindow, newest: CivilDate): OwedInPeriod {
  const range = periodRange(period, window)
  // A cost the owner paid can be dated after the newest bank row, and the books on the last day still hold it.
  const latest = books.ownerAdvances.reduce((last, advance) => (advance.date > last ? advance.date : last), newest)
  const on = range === null || range.to > latest ? latest : range.to
  const from = range?.from ?? null
  const firstDay = books.transactions.reduce((earliest, row) => (row.date < earliest ? row.date : earliest), on)
  const end = booksBefore(books, addDays(on, 1))
  const start = from === null ? null : booksBefore(books, from)
  const upTo = (day: CivilDate, filters: Partial<FilterState>): DrillTarget => drillToTransactions({ period: { preset: 'custom', range: { from: firstDay, to: day } }, ...filters })
  const beforeStart = from === null || addDays(from, -1) < firstDay ? null : addDays(from, -1)
  const startOf = (amount: Money | undefined, filters: Partial<FilterState>): Balance => ({
    amount: amount ?? ZERO,
    drill: beforeStart === null ? null : upTo(beforeStart, filters),
  })
  const loanFilters = loanBookFilters(books.categories)
  const advanceFilters = advanceBookFilters(books.categories)
  const during = (began: CivilDate, open: boolean, closedOn: CivilDate | null): boolean => from === null || began >= from || open || (closedOn !== null && closedOn >= from)
  const net = netOwed(end.loans, end.advances, books.categories)
  const openLoans = end.loans.loans.filter((loan) => loan.status === 'open')
  return {
    on,
    net: { ...net, drill: upTo(on, net.drill.filters) },
    unaccountedTotal: end.advances.unaccountedTotal,
    loans: {
      start: startOf(start?.loans.outstanding.amount, loanFilters.outstanding),
      added: { amount: subtractMoney(end.loans.lent.amount, start?.loans.lent.amount ?? ZERO), drill: drillToTransactions({ period, ...loanFilters.lent }) },
      settled: { amount: subtractMoney(end.loans.repaid.amount, start?.loans.repaid.amount ?? ZERO), drill: drillToTransactions({ period, ...loanFilters.repaid }) },
      end: { amount: end.loans.outstanding.amount, drill: upTo(on, loanFilters.outstanding) },
    },
    loanList: end.loans.loans.filter((loan) => during(loan.lentOn, loan.status === 'open', loan.repaidOn)),
    openLoans: openLoans.length,
    oldestOpenLoan: openLoans[0]?.lentOn ?? null,
    advances: {
      start: startOf(start?.advances.outstanding.amount, advanceFilters.outstanding),
      added: { amount: subtractMoney(end.advances.advanced.amount, start?.advances.advanced.amount ?? ZERO), drill: drillToTransactions({ period, ...advanceFilters.advanced }) },
      settled: { amount: subtractMoney(end.advances.reimbursed.amount, start?.advances.reimbursed.amount ?? ZERO), drill: drillToTransactions({ period, ...advanceFilters.reimbursed }) },
      end: { amount: end.advances.outstanding.amount, drill: upTo(on, advanceFilters.outstanding) },
    },
    advanceList: end.advances.advances.filter((line) => during(line.advance.date, line.status === 'open', line.repaidOn)),
  }
}

/** The loan book and the costs the owner paid from the rows dated before a day. */
function booksBefore(books: Books, day: CivilDate) {
  const rows = books.transactions.filter((row) => row.date < day)
  const advances = books.ownerAdvances.filter((advance) => advance.date < day)
  return { loans: ownerLoans(rows, books.categories), advances: ownerAdvances(advances, rows, books.categories) }
}
