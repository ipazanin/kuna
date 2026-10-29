import { drillToTransactions, rowDrill } from '../../../../filters/domain/drillTarget'
import type { DrillTarget } from '../../../../filters/domain/drillTarget'
import type { Category, Transaction } from '../../../../workbook/domain/workbook'
import type { CivilDate } from '../../../../../../shared/calendar/civilDate'
import { monthOf } from '../../../../../../shared/calendar/monthKey'
import { negateMoney, subtractMoney, sumMoney } from '../../../../../../shared/money/money'
import type { Money } from '../../../../../../shared/money/money'
import type { TracedFigure } from '../../ruleset/tracedFigure'
import { withDrill } from '../accrual/accrualAdjustment'
import { PACK_ROLES, categoriesWithRole } from '../packRoles'
import { summed, tracedFigure } from '../payroll/payrollArithmetic'
import type { CitObligation, CitSchedule } from './citSchedule'

/** `due` falls due in the month of the day matched on, `to-come` later, `overdue` before it. */
export type CitObligationStatus = 'paid' | 'due' | 'overdue' | 'to-come'

export interface MatchedCitObligation {
  readonly obligation: CitObligation
  readonly status: CitObligationStatus
  /** What bank rows paid on it, one step per row that opens it. */
  readonly paid: TracedFigure
  readonly outstanding: Money
}

export interface CitAdvancesPaid {
  readonly year: number
  /** PD line 56: the advances paid for the year's months, whenever they were paid. */
  readonly paid: TracedFigure
}

export interface CitPaymentMatching {
  /** Every obligation of the schedules, by due date. */
  readonly obligations: readonly MatchedCitObligation[]
  /** Payments, or what was left of them, that no obligation took, and refunds, which read negative. */
  readonly unmatched: readonly TracedFigure[]
  /** One per schedule. */
  readonly advancesPaid: readonly CitAdvancesPaid[]
}

/**
 * Matches the bank rows on corporate tax categories to the obligations, each payment filling the
 * oldest obligation by due date first. The annual payment and the advances carry the same payment
 * code, so the schedule is the only way to tell them apart. Pass the schedules of every year from
 * the first tax period, so that every payment in the ledger has the obligation it was made for.
 */
export function matchCitPayments(schedules: readonly CitSchedule[], transactions: readonly Transaction[], categories: readonly Category[], asOf: CivilDate): CitPaymentMatching {
  const slugs = categoriesWithRole(categories, PACK_ROLES.corporateIncomeTax)
  const rows = transactions.filter((row) => slugs.includes(row.category)).sort((earlier, later) => earlier.date.localeCompare(later.date) || earlier.sequence - later.sequence)
  const obligations = schedules.flatMap((schedule) => schedule.obligations).sort((earlier, later) => earlier.dueOn.localeCompare(later.dueOn) || earlier.taxYear - later.taxYear)

  const filling = obligations.map((obligation) => ({ obligation, outstanding: obligation.expected.amount, shares: [] as RowShare[] }))
  const unmatched: TracedFigure[] = []
  for (const row of rows) {
    let left = negateMoney(row.amount)
    for (const entry of filling) {
      if (left <= 0) {
        break
      }
      if (entry.outstanding > 0) {
        const taken = entry.outstanding < left ? entry.outstanding : left
        entry.outstanding = subtractMoney(entry.outstanding, taken)
        entry.shares.push({ row, amount: taken })
        left = subtractMoney(left, taken)
      }
    }
    if (left !== 0) {
      unmatched.push(paymentStep({ row, amount: left }))
    }
  }

  const matched = filling.map(({ obligation, outstanding, shares }): MatchedCitObligation => {
    const steps = shares.map(paymentStep)
    const paid = tracedFigure(`${obligation.expected.label}, paid`, sumMoney(steps.map((step) => step.amount)), 'ledger', obligation.expected.rules, steps)
    return { obligation, status: statusOf(obligation, outstanding, asOf), paid: withDrill(paid, drillOf(shares, slugs)), outstanding }
  })
  return {
    obligations: matched,
    unmatched,
    advancesPaid: schedules.map((schedule) => {
      const paid = matched.filter((entry) => entry.obligation.kind === 'advance' && entry.obligation.taxYear === schedule.year && entry.paid.amount !== 0)
      return {
        year: schedule.year,
        paid: summed(
          `PD line 56, advances paid for ${schedule.year}`,
          paid.map((entry) => entry.paid),
          'ledger',
        ),
      }
    }),
  }
}

/** What is still to pay on an obligation, named with the day it falls due. */
export function outstandingFigure(entry: MatchedCitObligation): TracedFigure {
  const { obligation } = entry
  return { ...tracedFigure(`${obligation.expected.label}, due`, entry.outstanding, 'ledger', obligation.expected.rules), on: obligation.dueOn }
}

function statusOf(obligation: CitObligation, outstanding: Money, asOf: CivilDate): CitObligationStatus {
  if (outstanding <= 0) {
    return 'paid'
  }
  if (obligation.dueOn < asOf) {
    return 'overdue'
  }
  return monthOf(obligation.dueOn) === monthOf(asOf) ? 'due' : 'to-come'
}

/** The part of a bank row that one obligation took, paid out reading positive. */
interface RowShare {
  readonly row: Transaction
  readonly amount: Money
}

function paymentStep(share: RowShare): TracedFigure {
  const { row } = share
  return withDrill({ ...tracedFigure(`${row.description || row.counterparty || row.category} on`, share.amount, 'ledger', []), on: row.date }, rowDrill(row))
}

/** The one row, or the corporate tax rows from the first payment to the last. */
function drillOf(shares: readonly RowShare[], slugs: readonly string[]): DrillTarget | null {
  const first = shares[0]
  const last = shares[shares.length - 1]
  if (first === undefined || last === undefined) {
    return null
  }
  return first.row === last.row ? rowDrill(first.row) : drillToTransactions({ period: { preset: 'custom', range: { from: first.row.date, to: last.row.date } }, categories: [...slugs] })
}
