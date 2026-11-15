import type { CivilDate } from '../../../../../../shared/calendar/civilDate'
import { civilDate } from '../../../../../../shared/calendar/civilDate'
import { addMonths, monthNumber, monthOf, yearOfMonth } from '../../../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../../../shared/calendar/monthKey'
import { ZERO, addMoney, moneyFromCents, sumMoney } from '../../../../../../shared/money/money'
import type { Money } from '../../../../../../shared/money/money'
import type { RateBook } from '../../../../../../shared/money/rateBook'
import type { RuleSource } from '../payroll/payrollArithmetic'
import type { PerDiemLine, PerDiemShare } from './perDiems'
import { perDiemsOf } from './perDiems'
import { legKilometres } from './trip'
import type { Trip } from './trip'
import { kmRateCapOn } from './tripDefaults'
import type { Employee } from '../employees/employees'
import { tripRowSuggestions } from './tripBankRows'
import type { TripBooks, TripRowSuggestion } from './tripBankRows'
import type { TripFile } from './tripReading'
import { settlementGaps, tripSettlement } from './tripSettlement'
import type { SettlementGap, WorkedSettlement } from './tripSettlement'

/** The payments of the tax-free caps table a trip's settlement pays, by the ruleset's payment key. */
export const TRIP_PAYMENTS = ['domestic-per-diem-over-12-hours', 'domestic-per-diem-8-to-12-hours', 'foreign-per-diem', 'private-car-business-travel', 'business-travel-cost'] as const

export type TripPaymentKey = (typeof TRIP_PAYMENTS)[number]

/** What a settlement pays in one tax-free payment of the caps table. */
export interface TripPayment {
  readonly payment: TripPaymentKey
  readonly amount: Money
}

function perDiemPayment(place: 'abroad' | 'home', share: PerDiemShare): TripPaymentKey | null {
  if (share === 'none') return null
  if (place === 'abroad') return 'foreign-per-diem'
  return share === 'full' ? 'domestic-per-diem-over-12-hours' : 'domestic-per-diem-8-to-12-hours'
}

/** The settlement's lines by tax-free payment, per diems first, then the kilometres, then the costs the traveller paid, each above zero. */
export function settlementPayments(settlement: WorkedSettlement): TripPayment[] {
  const amounts = new Map<TripPaymentKey, Money>()
  const add = (payment: TripPaymentKey, amount: Money) => amounts.set(payment, addMoney(amounts.get(payment) ?? ZERO, amount))
  for (const line of settlement.perDiemLines) {
    const payment = perDiemPayment(line.place, line.share)
    if (payment !== null) add(payment, line.amount)
  }
  if (settlement.kilometres !== null) add('private-car-business-travel', settlement.kilometres.amount)
  add('business-travel-cost', settlement.travellerCosts)
  return TRIP_PAYMENTS.flatMap((payment) => {
    const amount = amounts.get(payment) ?? ZERO
    return amount > 0 ? [{ payment, amount }] : []
  })
}

/** The payments of the caps table a trip's per diems are paid in. */
const PER_DIEM_PAYMENTS: ReadonlySet<string> = new Set<TripPaymentKey>(['domestic-per-diem-over-12-hours', 'domestic-per-diem-8-to-12-hours', 'foreign-per-diem'])

/**
 * What caps a payment that a settled trip links: the trip's per-diem lines paid in that payment, each already less its meals, or for
 * any other payment the kilometres of a private car, zero for a payment the trip does not pay by the unit. While the per diems wait,
 * such as for the ECB rate of a per diem in dollars, it says what for.
 */
export type TripCap =
  { readonly kind: 'per-diems'; readonly lines: readonly PerDiemLine[] } | { readonly kind: 'units'; readonly units: number } | { readonly kind: 'waits'; readonly gaps: readonly SettlementGap[] }

export function tripCapOf(file: TripFile, payment: string, rules: RuleSource, rates: RateBook): TripCap {
  if (!PER_DIEM_PAYMENTS.has(payment)) return { kind: 'units', units: payment === 'private-car-business-travel' && file.trip.car !== null ? legKilometres(file.legs) : 0 }
  const perDiems = perDiemsOf(file.trip, rules, rates)
  if (perDiems === null) return { kind: 'waits', gaps: settlementGaps(file, rules, rates) }
  return { kind: 'per-diems', lines: perDiems.lines.filter((line) => perDiemPayment(line.place, line.share) === payment) }
}

/** The trip's line under JOPPD code 17: per diems and private car kilometres up to the tax-free amounts, in the month the trip was settled. */
export interface TripReport {
  readonly trip: Trip
  readonly month: MonthKey
  /** Null while the settlement waits for something, such as the ECB rate of a per diem in dollars. */
  readonly amount: Money | null
  /** The day the month's report is due by. */
  readonly dueOn: CivilDate
}

/** The tax-free part of a settlement that code 17 reports: the per diems, and the kilometres at the order's rate or the cap, whichever is lower. */
export function code17Amount(file: TripFile, settlement: WorkedSettlement, rules: RuleSource): Money {
  const { kilometres } = settlement
  if (kilometres === null) return settlement.perDiems
  const cap = kmRateCapOn(file.trip.left?.day ?? file.trip.departs, rules)
  const rate = cap !== null && cap < kilometres.rate ? cap : kilometres.rate
  return sumMoney([settlement.perDiems, moneyFromCents(rate * kilometres.km)])
}

/**
 * The code 17 line of each settled trip that pays per diems or kilometres. An advance is reported only once the trip is settled
 * (PravPDoh Art. 79(9)), so the line goes in the month of the settled day, reported by the day of the next month the rule gives.
 */
export function tripReports(files: readonly TripFile[], rules: RuleSource, rates: RateBook): TripReport[] {
  return files.flatMap((file): TripReport[] => {
    const { settledOn } = file.trip
    if (settledOn === null) return []
    const law = rules('hr.pit.trip-joppd', settledOn).value
    const month = monthOf(settledOn)
    const next = addMonths(month, 1)
    const dueOn = civilDate(yearOfMonth(next), monthNumber(next), law.reportedByDay.count)
    const settlement = tripSettlement(file, rules, rates)
    if (settlement.kind === 'waiting') return [{ trip: file.trip, month, amount: null, dueOn }]
    const amount = code17Amount(file, settlement, rules)
    return amount > 0 ? [{ trip: file.trip, month, amount, dueOn }] : []
  })
}

/** The code 17 lines of one month, for one traveller or everyone, with their total, which is null while a line waits for something. */
export function tripReportsOfMonth(
  files: readonly TripFile[],
  month: MonthKey,
  traveller: string | null,
  rules: RuleSource,
  rates: RateBook,
): { readonly reports: readonly TripReport[]; readonly total: Money | null } {
  const reports = tripReports(files, rules, rates).filter((report) => report.month === month && (traveller === null || report.trip.traveller === traveller))
  const amounts = reports.flatMap((report) => (report.amount === null ? [] : [report.amount]))
  return { reports, total: amounts.length === reports.length ? sumMoney(amounts) : null }
}

/** A code 17 line waiting to be reported, late once its due day has passed. */
export interface ReportWaiting {
  readonly report: TripReport
  readonly late: boolean
}

/** Whether a code 17 line still waits to be reported on the day, and whether it is late: from the settled day until a person marks it reported, late after the day it is due by. */
export function reportWaiting(report: TripReport, asOf: CivilDate): ReportWaiting | null {
  const { settledOn, reportedOn } = report.trip
  if (settledOn === null || reportedOn !== null || asOf < settledOn) return null
  return { report, late: report.dueOn < asOf }
}

/** What waits on the trips: each payment Kuna found for a trip's advance or payout that no one has linked or set aside, and each code 17 line not yet marked reported, as `reportWaiting` decides. */
export function tripsWaiting(
  files: readonly TripFile[],
  employees: readonly Employee[],
  books: TripBooks,
  asOf: CivilDate,
  rules: RuleSource,
  rates: RateBook,
): { readonly toLink: readonly (TripRowSuggestion & { readonly trip: Trip })[]; readonly reports: readonly ReportWaiting[] } {
  const trips = files.map((file) => file.trip)
  const toLink = files.flatMap((file) => {
    const settlement = tripSettlement(file, rules, rates)
    const traveller = employees.find((employee) => employee.slug === file.trip.traveller) ?? null
    return tripRowSuggestions(file, settlement.kind === 'worked' ? settlement : null, traveller, trips, books).map((suggestion) => ({ ...suggestion, trip: file.trip }))
  })
  const reports = tripReports(files, rules, rates).flatMap((report) => reportWaiting(report, asOf) ?? [])
  return { toLink, reports }
}
