import type { DrillTarget } from '../../../../features/filters/domain/drillTarget'
import { RECEIVABLE_ROLES } from '../../../../features/receivables/domain/invoiceMatching'
import { PROFIT_AND_LOSS_BUCKETS } from '../../../../features/workbook/domain/bucket'
import type { Bucket } from '../../../../features/workbook/domain/bucket'
import { bookingOfAdvance } from '../../../../features/workbook/domain/workbook'
import type { Booking, Category, OwnerAdvance, Transaction, Workbook } from '../../../../features/workbook/domain/workbook'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { monthOf } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import type { Money } from '../../../../shared/money/money'
import { ruleValue } from '../../ruleset/ruleset'
import type { RuleCitation } from '../../ruleset/schema'
import type { TracedFigure } from '../../ruleset/tracedFigure'
import { assetRegister } from '../assets/assetRegister'
import { advanceDrill } from '../ownerAdvances'
import { withDrill } from './accrualAdjustment'
import { rowDrill } from '../ownerLoans'
import { PACK_ROLES } from '../packRoles'
import { tracedFigure } from '../payroll/payrollArithmetic'
import type { RuleSource } from '../payroll/payrollArithmetic'
import { vatSplit } from '../vat/vatSplit'
import type { VatSplit } from '../vat/vatSplit'
import { prepaymentSpread } from './prepaymentSpread'
import { serviceMonthOf } from './serviceMonth'

/** What the accrual view does with a booking the cash view counts, when it takes the booking out of profit whole. */
export type TakenOutTreatment =
  /** Replaced by revenue by delivery period. */
  | 'revenue'
  /** A receivable from the owner, not a cost. */
  | 'owner-loan'
  /** Replaced by the grant's release. */
  | 'grant'
  | 'profit-distribution'
  /** Replaced by the year's own corporate tax. */
  | 'corporate-income-tax'
  /** A settlement of the VAT position. */
  | 'vat-settlement'

/** Why a counted booking falls in the months it does. */
export type BookingTiming = 'paid' | 'arrears' | 'prepaid' | 'kept-in-month-paid'

/** A counted booking's amount in one month, without deductible VAT, signed as booked so a cost is negative. */
export interface MonthShare {
  readonly month: MonthKey
  readonly amount: Money
}

export type BookingSource = { readonly kind: 'ledger'; readonly row: Transaction } | { readonly kind: 'owner-advance'; readonly advance: OwnerAdvance }

interface BookingBase {
  readonly booking: Booking
  readonly category: Category
  readonly source: BookingSource
  /** Who or what the booking was with, without its day. */
  readonly label: string
  readonly drill: DrillTarget
}

export interface TakenOutBooking extends BookingBase {
  readonly treatment: TakenOutTreatment
}

/** Moved to the asset books at its cost without deductible VAT. */
export interface CapitalisedBooking extends BookingBase {
  readonly treatment: 'capitalised'
  readonly vat: VatSplit
}

/** Counted without its deductible VAT, in the months it belongs to. */
export interface CountedBooking extends BookingBase {
  readonly treatment: 'counted'
  readonly vat: VatSplit
  readonly timing: BookingTiming
  readonly shares: readonly MonthShare[]
}

export type AccrualBooking = TakenOutBooking | CapitalisedBooking | CountedBooking

const PROFIT_AND_LOSS: ReadonlySet<Bucket> = new Set(PROFIT_AND_LOSS_BUCKETS)

/** An annual policy paid ahead covers the twelve months from its payment. */
const PREPAID_MONTHS = 12

/** Roles that take a booking out of profit and loss whole, in the order they are tried. */
const TAKEN_OUT: readonly (readonly [role: string, treatment: TakenOutTreatment])[] = [
  [PACK_ROLES.ownerLoanOut, 'owner-loan'],
  [PACK_ROLES.ownerLoanRepaid, 'owner-loan'],
  [PACK_ROLES.grant, 'grant'],
  [PACK_ROLES.profitDistribution, 'profit-distribution'],
  [PACK_ROLES.corporateIncomeTax, 'corporate-income-tax'],
  [PACK_ROLES.vatSettlement, 'vat-settlement'],
  [PACK_ROLES.revenue, 'revenue'],
  [RECEIVABLE_ROLES.clientRefund, 'revenue'],
]

/**
 * Every booking the cash view counts, bank rows and the owner's advances alike, with what the
 * accrual view does with it. A capital purchase goes to the asset books only when an asset row
 * claims it. One no asset claims is small inventory and counts as a cost when paid.
 */
export function accrualBookings(workbook: Workbook, rules: RuleSource = ruleValue): readonly AccrualBooking[] {
  const categories = new Map(workbook.categories.map((category) => [category.slug, category]))
  const register = assetRegister(workbook.assets, workbook.transactions, workbook.categories, rules)
  const claimed = new Set(register.assets.flatMap((entry) => (entry.payment === null ? [] : [entry.payment.row])))
  const sources: BookingSource[] = [
    ...workbook.transactions.map((row): BookingSource => ({ kind: 'ledger', row })),
    ...workbook.ownerAdvances.map((advance): BookingSource => ({ kind: 'owner-advance', advance })),
  ].sort(oldestFirst)
  return sources.flatMap((source): AccrualBooking[] => {
    const booking = source.kind === 'ledger' ? source.row : bookingOfAdvance(source.advance)
    const category = categories.get(booking.category)
    if (category === undefined || !PROFIT_AND_LOSS.has(booking.bucket)) {
      return []
    }
    const described = { booking: plainBooking(booking), category, source, label: labelOf(source), drill: drillOf(source) }
    const takenOut = TAKEN_OUT.find(([role]) => category.roles.includes(role))
    if (takenOut !== undefined) {
      return [{ ...described, treatment: takenOut[1] }]
    }
    const vat = vatSplit(described.booking, category, rules)
    if (source.kind === 'ledger' && claimed.has(source.row)) {
      return [{ ...described, treatment: 'capitalised', vat }]
    }
    return [{ ...described, treatment: 'counted', vat, ...timed(described.booking, vat, category, workbook, rules) }]
  })
}

/** Whether the accrual view counts a category's bookings as income or cost, rather than taking them out of profit whole. */
export function countsInProfit(category: Category): boolean {
  return PROFIT_AND_LOSS.has(category.bucket) && !TAKEN_OUT.some(([role]) => category.roles.includes(role))
}

export function isCounted(entry: AccrualBooking): entry is CountedBooking {
  return entry.treatment === 'counted'
}

/** A counted or capitalised booking, which carries its VAT split. */
export function hasVat(entry: AccrualBooking): entry is CountedBooking | CapitalisedBooking {
  return entry.treatment === 'counted' || entry.treatment === 'capitalised'
}

/** An amount of a booking as a step named by the booking and its day, which opens its row. */
export function bookingFigure(entry: AccrualBooking, amount: Money, label = `${entry.label} on`, rules: readonly RuleCitation[] = []): TracedFigure {
  return withDrill({ ...tracedFigure(label, amount, 'ledger', rules), on: entry.booking.date }, entry.drill)
}

/** The same booking in the month it was paid, for a cut-off that keeps it out of the month before. */
export function keptInMonthPaid(entry: CountedBooking): CountedBooking {
  return { ...entry, timing: 'kept-in-month-paid', shares: [{ month: monthOf(entry.booking.date), amount: entry.vat.cost.amount }] }
}

function timed(
  booking: Booking,
  vat: VatSplit,
  category: Category,
  workbook: Workbook,
  rules: RuleSource,
): { readonly timing: BookingTiming; readonly shares: readonly MonthShare[] } {
  const cost = vat.cost.amount
  if (category.roles.includes(PACK_ROLES.arrears)) {
    return { timing: 'arrears', shares: [{ month: serviceMonthOf(booking, workbook.categories, workbook.settings), amount: cost }] }
  }
  if (category.roles.includes(PACK_ROLES.prepaidAnnual)) {
    const spread = prepaymentSpread({ ...booking, amount: cost }, PREPAID_MONTHS, rules)
    return { timing: 'prepaid', shares: spread.map((share) => ({ month: share.month, amount: share.cost.amount })) }
  }
  return { timing: 'paid', shares: [{ month: monthOf(booking.date), amount: cost }] }
}

/** By day, bank rows in booking order before the advances in tab order. */
function oldestFirst(earlier: BookingSource, later: BookingSource): number {
  const byDate = dateOf(earlier).localeCompare(dateOf(later))
  if (byDate !== 0) {
    return byDate
  }
  if (earlier.kind === 'ledger' && later.kind === 'ledger') {
    return earlier.row.sequence - later.row.sequence
  }
  if (earlier.kind === 'owner-advance' && later.kind === 'owner-advance') {
    return earlier.advance.sheetRow - later.advance.sheetRow
  }
  return earlier.kind === 'ledger' ? -1 : 1
}

function dateOf(source: BookingSource): CivilDate {
  return source.kind === 'ledger' ? source.row.date : source.advance.date
}

function plainBooking(booking: Booking): Booking {
  return { date: booking.date, amount: booking.amount, category: booking.category, family: booking.family, bucket: booking.bucket }
}

function labelOf(source: BookingSource): string {
  if (source.kind === 'owner-advance') {
    return source.advance.description || 'Paid by the owner'
  }
  return source.row.counterparty || source.row.description || source.row.category
}

function drillOf(source: BookingSource): DrillTarget {
  return source.kind === 'ledger' ? rowDrill(source.row) : advanceDrill(source.advance)
}
