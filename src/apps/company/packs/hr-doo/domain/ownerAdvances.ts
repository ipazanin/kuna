import type { CivilDate } from '../../../../../shared/calendar/civilDate'
import { ZERO, absMoney, addMoney, moneyFromCents, subtractMoney } from '../../../../../shared/money/money'
import type { Money } from '../../../../../shared/money/money'
import { settlePayments } from '../../../../../shared/money/settleOpenRows'
import { advanceDrill, drillToTransactions, rowDrill } from '../../../filters/domain/drillTarget'
import type { DrillTarget, Figure } from '../../../filters/domain/drillTarget'
import { EVERY_OWNER_ADVANCE } from '../../../filters/domain/filterState'
import type { AmountRange, FilterState } from '../../../filters/domain/filterState'
import { scopeTransactions } from '../../../transactions/domain/filterTransactions'
import { ownerAdvanceOrder } from '../../../workbook/domain/workbook'
import type { Category, OwnerAdvance, Transaction } from '../../../workbook/domain/workbook'
import type { OwnerLoanBook } from './ownerLoans'
import { PACK_ROLES, categoriesWithRole } from './packRoles'
import { netReimbursements } from './reimbursements'
import type { RepaidBy } from './ownerAdvancesReading'
import type { HrDooWorkbook } from './hrDooPart'
import type { NetReimbursement, ReimbursementRow } from './reimbursements'
import { itemIdOfRow } from '../../../workbook/domain/splits'

/** The part of one reimbursement that went towards one advance. */
export interface AdvanceRepaymentShare {
  readonly repaidOn: CivilDate
  readonly applied: Money
  /** The reimbursement row, whose amount may be larger when it also settled a neighbouring advance. */
  readonly drill: DrillTarget
}

export interface OwnerAdvanceLine {
  readonly advance: OwnerAdvance
  /** The advance itself on Transactions, found by its day and its exact cost. */
  readonly drill: DrillTarget
  readonly remaining: Money
  readonly status: 'repaid' | 'open'
  /** The reimbursement that settled it. Null while it is open. */
  readonly repaidOn: CivilDate | null
  readonly repayments: readonly AdvanceRepaymentShare[]
}

/** A payment to the owner on a reimbursement category that no cost on the owner-advances tab accounts for, in part or in full. */
export interface UnaccountedReimbursement {
  readonly payment: Transaction
  /** What no cost accounts for, read positive. The payment itself may be larger when it also repaid a cost. */
  readonly amount: Money
  readonly drill: DrillTarget
}

export interface OwnerAdvanceBook {
  /** The costs the owner paid, oldest first. */
  readonly advances: readonly OwnerAdvanceLine[]
  /** Oldest first. Net owed counts them as paid to the owner until their costs are on the tab. */
  readonly unaccounted: readonly UnaccountedReimbursement[]
  /** Every cost the owner paid privately. */
  readonly advanced: Figure
  /**
   * Every payment to the owner on a reimbursement category, read positive, less what it returned of
   * a payment from the owner the same day, including any beyond the advances.
   */
  readonly reimbursed: Figure
  /** Advanced less reimbursed, signed. Positive means the company still owes the owner. */
  readonly outstanding: Figure
  readonly openCount: number
  /** What the unaccounted payments add up to, read positive. */
  readonly unaccountedTotal: Money
}

/** One signed balance across both directions. Positive means the owner owes the company. */
export interface NetOwed {
  readonly amount: Money
  /** What the loan book holds: lent, private costs included, less what the owner repaid. */
  readonly loanBalance: Money
  /** Paid by the owner less reimbursed. */
  readonly advancesOutstanding: Money
  /** The loan and reimbursement rows and every advance. */
  readonly drill: DrillTarget
}

const DEBITS: AmountRange = { min: null, max: moneyFromCents(-1) }

/** What of one payment to the owner pays back one advance. */
export interface AdvanceShare {
  readonly advance: OwnerAdvance
  /** Above zero. */
  readonly applied: Money
}

/** A payment to the owner, less what a payment the other way returned the same day, with the advances it pays back. */
export interface PlacedRepayment<Row extends ReimbursementRow = Transaction> extends NetReimbursement<Row> {
  readonly shares: readonly AdvanceShare[]
}

/** An advance with what of it is still open, read positive. */
export interface OpenAdvance {
  readonly advance: OwnerAdvance
  readonly open: Money
}

/**
 * Where payments to the owner, given oldest first, go among the advances, given oldest first with what is open of each. Each
 * payment settles the fewest advances paid by its day that it equals exactly, and the payments no set of advances equals then go
 * to the oldest open advances first with no date cap. What no advance takes stays with the payment.
 */
export function placeRepayments<Row extends ReimbursementRow>(advances: readonly OpenAdvance[], payments: readonly NetReimbursement<Row>[]): PlacedRepayment<Row>[] {
  const placed = settlePayments(
    advances.map((advance) => advance.open),
    payments.map((payment) => payment.amount),
    (payment, row) => advances[row]!.advance.date <= payments[payment]!.payment.date,
  )
  return payments.map((payment, index) => ({ ...payment, shares: placed[index]!.map(({ index: row, applied }) => ({ advance: advances[row]!.advance, applied })) }))
}

/** What each advance was paid back, by the advance's place, the payments to the owner an advance names, and what no advance accounts for. */
export interface Repayments {
  readonly shares: readonly (readonly AdvanceRepaymentShare[])[]
  readonly named: ReadonlySet<Transaction>
  readonly unaccounted: readonly UnaccountedReimbursement[]
}

/**
 * What each advance's items paid back: each item of a payment to the owner on a reimbursement category, whole, in booking order.
 * An item no such payment holds, or one an older advance names already, pays back nothing. Each payment to the owner no advance
 * names, less what a payment from the owner returned the same day, is unaccounted.
 */
export function storedRepayments(advances: readonly OwnerAdvance[], repaidBy: RepaidBy, transactions: readonly Transaction[], categories: readonly Category[]): Repayments {
  const byItem = new Map(paymentsToOwner(transactions, categories).map((row) => [itemIdOfRow(row), row]))
  const named = new Set<Transaction>()
  const shares = advances.map((advance) =>
    (repaidBy.get(advance.id) ?? [])
      .flatMap((item) => {
        const row = byItem.get(item)
        if (row === undefined || named.has(row)) return []
        named.add(row)
        return [row]
      })
      .sort((earlier, later) => earlier.date.localeCompare(later.date) || earlier.sequence - later.sequence)
      .map((row): AdvanceRepaymentShare => ({ repaidOn: row.date, applied: absMoney(row.amount), drill: rowDrill(row) })),
  )
  const unaccounted = netReimbursements(
    transactions.filter((row) => !named.has(row)),
    categories,
  ).toOwner.map((repayment): UnaccountedReimbursement => ({ ...repayment, drill: rowDrill(repayment.payment) }))
  return { shares, named, unaccounted }
}

/** The rows that pay the owner on a reimbursement category, each item of a split row its own. */
export function paymentsToOwner<Row extends Pick<Transaction, 'category' | 'amount'>>(transactions: readonly Row[], categories: readonly Category[]): Row[] {
  const reimbursement = categoriesWithRole(categories, PACK_ROLES.reimbursement)
  return transactions.filter((row) => row.amount < 0 && reimbursement.includes(row.category))
}

/** Every payment to the owner placed on the advances, given oldest first, as books from before items match them on every read. */
export function matchedPayments(advances: readonly OwnerAdvance[], transactions: readonly Transaction[], categories: readonly Category[]): PlacedRepayment[] {
  return placeRepayments(
    advances.map((advance) => ({ advance, open: advance.amount })),
    netReimbursements(transactions, categories).toOwner,
  )
}

/** What each advance was paid back and what no advance accounts for, by the matching of books from before items. */
function matchedRepayments(advances: readonly OwnerAdvance[], transactions: readonly Transaction[], categories: readonly Category[]): Repayments {
  const placed = matchedPayments(advances, transactions, categories)
  const shares = advances.map((advance) =>
    placed.flatMap((repayment) =>
      repayment.shares
        .filter((share) => share.advance === advance)
        .map((share): AdvanceRepaymentShare => ({ repaidOn: repayment.payment.date, applied: share.applied, drill: rowDrill(repayment.payment) })),
    ),
  )
  const unaccounted = placed.flatMap((repayment): UnaccountedReimbursement[] => {
    const left = repayment.shares.reduce((rest, share) => subtractMoney(rest, share.applied), repayment.amount)
    return left > 0 ? [{ payment: repayment.payment, amount: left, drill: rowDrill(repayment.payment) }] : []
  })
  return { shares, named: new Set(), unaccounted }
}

/**
 * The costs the owner paid and the reimbursements paid to the owner. In books that keep items each advance is paid back by the
 * items it names, and each payment to the owner no advance names, less what a payment from the owner returned the same day, is
 * unaccounted. Books from before items match them on every read, as `placeRepayments` places the payments. The balance comes
 * from the rows themselves, so it states a reimbursement no advance accounts for.
 */
export function ownerAdvances(advances: readonly OwnerAdvance[], transactions: readonly Transaction[], categories: readonly Category[], repaidBy: RepaidBy | undefined): OwnerAdvanceBook {
  const paidByOwner = [...advances].sort(ownerAdvanceOrder)
  const { shares, unaccounted } = repaidBy === undefined ? matchedRepayments(paidByOwner, transactions, categories) : storedRepayments(paidByOwner, repaidBy, transactions, categories)
  const lines = paidByOwner.map((advance, index): OwnerAdvanceLine => {
    const repaymentShares = shares[index]!
    const remaining = repaymentShares.reduce((open, share) => subtractMoney(open, share.applied), advance.amount)
    return {
      advance,
      drill: advanceDrill(advance),
      remaining,
      status: remaining > 0 ? 'open' : 'repaid',
      repaidOn: remaining > 0 ? null : (repaymentShares[repaymentShares.length - 1]?.repaidOn ?? null),
      repayments: repaymentShares,
    }
  })

  const advanced = paidByOwner.reduce((total, advance) => addMoney(total, advance.amount), ZERO)
  const reimbursed = netReimbursements(transactions, categories).toOwner.reduce((total, repayment) => addMoney(total, repayment.amount), ZERO)
  const filters = advanceBookFilters(categories)
  return {
    advances: lines,
    advanced: { amount: advanced, drill: drillToTransactions({ period: { preset: 'all' }, ...filters.advanced }) },
    reimbursed: { amount: reimbursed, drill: drillToTransactions({ period: { preset: 'all' }, ...filters.reimbursed }) },
    outstanding: { amount: subtractMoney(advanced, reimbursed), drill: drillToTransactions({ period: { preset: 'all' }, ...filters.outstanding }) },
    openCount: lines.filter((line) => line.status === 'open').length,
    unaccounted,
    unaccountedTotal: unaccounted.reduce((total, line) => addMoney(total, line.amount), ZERO),
  }
}

/**
 * The filters behind the costs the owner paid, the reimbursements and the balance, without a period.
 * The debit bound leaves out the reimbursements from the owner, which repay the loan book.
 */
export function advanceBookFilters(categories: readonly Category[]): Record<'advanced' | 'reimbursed' | 'outstanding', Partial<FilterState>> {
  const reimbursement = categoriesWithRole(categories, PACK_ROLES.reimbursement)
  return {
    advanced: { categories: [EVERY_OWNER_ADVANCE], amount: DEBITS },
    reimbursed: { categories: reimbursement, amount: DEBITS },
    outstanding: { categories: [...reimbursement, EVERY_OWNER_ADVANCE], amount: DEBITS },
  }
}

/** What the owner owes the company on the loan book, less what the company owes the owner for the costs the owner paid. */
export function netOwed(loans: OwnerLoanBook, advances: OwnerAdvanceBook, categories: readonly Category[]): NetOwed {
  return {
    amount: subtractMoney(loans.outstanding.amount, advances.outstanding.amount),
    loanBalance: loans.outstanding.amount,
    advancesOutstanding: advances.outstanding.amount,
    drill: drillToTransactions({
      period: { preset: 'all' },
      categories: [
        ...categoriesWithRole(categories, PACK_ROLES.ownerLoanOut),
        ...categoriesWithRole(categories, PACK_ROLES.ownerLoanRepaid),
        ...categoriesWithRole(categories, PACK_ROLES.reimbursement),
        EVERY_OWNER_ADVANCE,
      ],
    }),
  }
}

/**
 * Payments to the owner under the filters that no cost the owner paid accounts for, which wait until a person
 * adds the cost. Payments match every cost on file, so a filter changes which are shown, never which match.
 */
export function unaccountedInView(booked: Pick<HrDooWorkbook, 'transactions' | 'ownerAdvances' | 'categories' | 'repaidBy'>, filters: FilterState): readonly UnaccountedReimbursement[] {
  const inView = new Set(scopeTransactions(booked.transactions, filters))
  return ownerAdvances(booked.ownerAdvances, booked.transactions, booked.categories, booked.repaidBy).unaccounted.filter((line) => inView.has(line.payment))
}
