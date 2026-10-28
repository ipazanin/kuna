import { yearOf } from '../../../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../../../shared/calendar/civilDate'
import { monthOf } from '../../../../../../shared/calendar/monthKey'
import { ZERO, moneyFromCents, subtractMoney, sumMoney } from '../../../../../../shared/money/money'
import type { Money } from '../../../../../../shared/money/money'
import { ruleValue } from '../../ruleset/ruleset'
import type { RuleLookup, RuleValues } from '../../ruleset/ruleset'
import type { FigureBasis, TracedFigure } from '../../ruleset/tracedFigure'
import { deducted, tracedFigure } from './payrollArithmetic'
import type { RuleSource } from './payrollArithmetic'

export interface NontaxablePaymentMade {
  /** The ruleset's payment key, such as `occasional-gift`. */
  readonly payment: string
  readonly paidOn: CivilDate
  readonly amount: Money
  /** Days for a per-day cap, kilometres for a per-kilometre cap, events for a per-event cap. */
  readonly units?: number
}

/** How much of one cap the payments of its period used. */
export interface NontaxableUsage {
  readonly payment: string
  /** The item numbers of the Pravilnik table that name the payment. */
  readonly items: readonly number[]
  /** The ruleset's period for the cap: `year`, `month`, `day`, `kilometre`, `event`, or one with no cap here. */
  readonly period: string
  /** `2026` for a yearly cap or a payment with no cap, `2026-03` for any other. */
  readonly periodKey: string
  readonly paid: TracedFigure
  /** Null when the payment is tax-free at actual cost or by another rule, so no cap applies here. */
  readonly cap: TracedFigure | null
  readonly remaining: TracedFigure | null
  /** The part over the cap, which is taxed as salary. */
  readonly excess: TracedFigure
}

type CapRow = RuleValues['hr.pit.nontaxable-caps']['caps']['rows'][number]

interface PaymentsInPeriod {
  readonly payment: string
  readonly periodKey: string
  readonly made: NontaxablePaymentMade[]
}

const UNCAPPED_PERIODS = new Set(['actual-cost', 'foreign-per-diem-rule'])
const PER_UNIT_PERIODS = new Map([
  ['day', 'days'],
  ['kilometre', 'kilometres'],
  ['event', 'events'],
])

/** The payments of a year against their caps, each cap looked up on the last payment date of its period. */
export function nontaxableUsage(
  payments: readonly NontaxablePaymentMade[],
  year: number,
  basis: FigureBasis,
  rules: RuleSource = ruleValue,
): readonly NontaxableUsage[] {
  const groups = new Map<string, PaymentsInPeriod>()
  for (const made of payments.filter((payment) => yearOf(payment.paidOn) === year)) {
    if (made.amount < 0) {
      throw new RangeError(`A ${made.payment} payment cannot be negative.`)
    }
    const period = capRowsOf(made.payment, rules('hr.pit.nontaxable-caps', made.paidOn))[0].period.text
    const periodKey = period === 'year' || UNCAPPED_PERIODS.has(period) ? String(year) : monthOf(made.paidOn)
    const groupKey = `${made.payment} ${periodKey}`
    const group = groups.get(groupKey) ?? { payment: made.payment, periodKey, made: [] }
    group.made.push(made)
    groups.set(groupKey, group)
  }
  return [...groups.values()]
    .sort((left, right) => left.payment.localeCompare(right.payment) || left.periodKey.localeCompare(right.periodKey))
    .map((group) => usageOf(group.payment, group.periodKey, group.made, basis, rules))
}

function usageOf(
  payment: string,
  periodKey: string,
  made: readonly NontaxablePaymentMade[],
  basis: FigureBasis,
  rules: RuleSource,
): NontaxableUsage {
  const lastPaidOn = made.map((payment) => payment.paidOn).reduce((latest, paidOn) => (paidOn > latest ? paidOn : latest))
  const capsRule = rules('hr.pit.nontaxable-caps', lastPaidOn)
  const rows = capRowsOf(payment, capsRule)
  const capRow = rows[0]
  const period = capRow.period.text
  const citations = [capsRule.citation]
  const paidSteps = made.map((payment) => ({ ...tracedFigure('Paid on', payment.amount, basis, citations), on: payment.paidOn }))
  const paid = tracedFigure(`${payment} paid in ${periodKey}`, sumMoney(paidSteps.map((step) => step.amount)), basis, citations, paidSteps)
  const cap = capOf(capRow, made, basis, capsRule)
  const items = rows.map((row) => row.item.count)
  if (cap === null) {
    return { payment, items, period, periodKey, paid, cap, remaining: null, excess: tracedFigure('No cap applies here', ZERO, basis, citations) }
  }
  const remaining = tracedFigure('Left under the cap', cap.amount > paid.amount ? subtractMoney(cap.amount, paid.amount) : ZERO, basis, citations, [
    cap,
    deducted(paid),
  ])
  const excess = tracedFigure(
    'Over the cap, taxed as salary',
    paid.amount > cap.amount ? subtractMoney(paid.amount, cap.amount) : ZERO,
    basis,
    citations,
    [paid, deducted(cap)],
  )
  return { payment, items, period, periodKey, paid, cap, remaining, excess }
}

function capRowsOf(payment: string, capsRule: RuleLookup<RuleValues['hr.pit.nontaxable-caps']>): readonly [CapRow, ...CapRow[]] {
  const rows = capsRule.value.caps.rows.filter((row) => row.payment.text === payment)
  const [first, ...rest] = rows
  if (first === undefined) {
    throw new RangeError(`${payment} is not a non-taxable payment the ruleset lists.`)
  }
  return [first, ...rest]
}

function capOf(
  capRow: CapRow,
  made: readonly NontaxablePaymentMade[],
  basis: FigureBasis,
  capsRule: RuleLookup<RuleValues['hr.pit.nontaxable-caps']>,
): TracedFigure | null {
  const period = capRow.period.text
  if (UNCAPPED_PERIODS.has(period)) {
    return null
  }
  const citations = [capsRule.citation]
  if (capRow.cap === undefined) {
    throw new RangeError(`The ruleset gives ${capRow.payment.text} no cap for its period ${period}.`)
  }
  const capAmount = capRow.cap.cents
  if (period === 'year' || period === 'month') {
    return tracedFigure(period === 'year' ? 'Yearly cap' : 'Monthly cap', capAmount, basis, citations)
  }
  const unitName = PER_UNIT_PERIODS.get(period)
  if (unitName === undefined) {
    throw new RangeError(`The cap period ${period} of ${capRow.payment.text} is not one the payroll engine knows.`)
  }
  const units = made.reduce((total, payment) => total + unitsOf(payment, unitName), 0)
  const perUnit = tracedFigure(`Cap for ${units} ${unitName}`, moneyFromCents(capAmount * units), basis, citations)
  const monthlyCap = capRow.monthlyCap?.cents
  if (monthlyCap === undefined || perUnit.amount <= monthlyCap) {
    return perUnit
  }
  return tracedFigure('Cap, limited to the monthly cap', monthlyCap, basis, citations, [perUnit])
}

function unitsOf(payment: NontaxablePaymentMade, unitName: string): number {
  if (payment.units === undefined || !Number.isInteger(payment.units) || payment.units < 0) {
    throw new RangeError(`The ${payment.payment} payment on ${payment.paidOn} needs a whole number of ${unitName}.`)
  }
  return payment.units
}
