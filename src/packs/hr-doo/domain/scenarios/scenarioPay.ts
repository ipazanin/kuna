import type { OwnerPayScenario } from '../../../../features/workbook/domain/ownerPayScenarios'
import { firstDayOf, lastDayOf } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { monthLabel } from '../../../../shared/calendar/monthLabel'
import { subtractMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { ruleValue } from '../../ruleset/ruleset'
import type { Rate, RuleCitation } from '../../ruleset/schema'
import type { TracedFigure } from '../../ruleset/tracedFigure'
import { annualSettlement } from '../payroll/annualSettlement'
import type { AnnualSettlement } from '../payroll/annualSettlement'
import type { EmployeeFacts } from '../payroll/incomeTax'
import { nontaxableUsage } from '../payroll/nontaxableUsage'
import { atRate, percentText, prorated, summed, tracedFigure } from '../payroll/payrollArithmetic'
import type { RuleSource } from '../payroll/payrollArithmetic'
import { payrollMonth } from '../payroll/payrollMonth'
import type { NontaxablePayment, PayrollMonth } from '../payroll/payrollMonth'
import type { ScenarioWarning } from './scenarioOutcome'
import { scenarioSchedule } from './scenarioSchedule'
import type { ScenarioSchedule } from './scenarioSchedule'

/** One month's rent to the owner and the rent tax the owner pays on it. */
export interface RentPart {
  readonly month: MonthKey
  readonly rent: TracedFigure
  readonly tax: TracedFigure
}

export interface OwnContributions {
  readonly pillarOne: TracedFigure
  readonly pillarTwo: TracedFigure
  readonly health: TracedFigure
  readonly total: TracedFigure
}

/** A scenario's pay worked through its months: the payroll, the annual settlement, the rent and what a board member pays himself. */
export interface ScenarioPay {
  readonly schedule: ScenarioSchedule
  /** One per month with a salary, in month order. */
  readonly payroll: readonly PayrollMonth[]
  /** Null when the scenario pays no salary. */
  readonly settlement: AnnualSettlement | null
  readonly rent: readonly RentPart[]
  /** Pension and health a director pays personally on the board member base for the days nothing else insures him. */
  readonly own: OwnContributions
  /** A salary agreed below the director floor, and a tax-free item over its yearly cap. */
  readonly warnings: readonly ScenarioWarning[]
}

const BASIS = 'plan'

/**
 * Each salary month of a scenario through the payroll, paid on the last day of the month worked,
 * tax-free items within their yearly caps and the part over them taxed as salary, the annual
 * settlement, the rent with its tax, and the contributions a board member pays himself. The
 * scenario's dividend is not pay, so it is left to the caller.
 */
export function scenarioPay(scenario: OwnerPayScenario, facts: EmployeeFacts, rules: RuleSource = ruleValue): ScenarioPay {
  const { year } = scenario
  const schedule = scenarioSchedule(scenario)
  const warnings: ScenarioWarning[] = []

  const usage = nontaxableUsage(
    schedule.nontaxable.map((plan) => ({ payment: plan.item.item, paidOn: plan.paidOn, amount: plan.item.amount })),
    year,
    BASIS,
    rules,
  )
  const split = splitAtCaps(schedule, usage)
  for (const entry of usage) {
    if (entry.cap !== null && entry.excess.amount > 0) {
      const sheetRows = schedule.nontaxable.filter((plan) => plan.item.item === entry.payment).map((plan) => plan.item.sheetRow)
      warnings.push({ kind: 'cap-exceeded', item: entry.payment, sheetRows, paid: entry.paid, cap: entry.cap, excess: entry.excess })
    }
  }

  const floors = new Set<number>()
  const payroll = schedule.salaryMonths.map((salaryMonth) => {
    const { month, salary } = salaryMonth
    const floorRule = rules('hr.contrib.director-floor', firstDayOf(month))
    const floor = floorRule.value.monthlyFloor.cents
    if (salary.gross !== 'floor' && salary.gross < floor && !floors.has(salary.sheetRow)) {
      floors.add(salary.sheetRow)
      warnings.push({ kind: 'below-floor', sheetRow: salary.sheetRow, agreed: salary.gross, floor: tracedFigure('Director floor for a full month', floor, BASIS, [floorRule.citation]) })
    }
    const paid = split.filter((part) => part.month === month)
    const nontaxablePayments: NontaxablePayment[] = paid.filter((part) => part.within > 0).map((part) => ({ payment: part.item, amount: part.within }))
    const over = paid.filter((part) => part.over > 0).map((part) => tracedFigure(`${part.item} over its cap`, part.over, BASIS, part.rules))
    return payrollMonth(
      {
        workedMonth: month,
        paidOn: lastDayOf(month),
        agreedMonthlyGross: salary.gross === 'floor' ? floor : salary.gross,
        daysWorked: salaryMonth.daysWorked,
        workingDaysInMonth: salaryMonth.workingDays,
        nontaxablePayments,
        ...(over.length === 0 ? {} : { overCaps: summed('Over the tax-free caps, taxed as salary', over, BASIS) }),
        basis: BASIS,
      },
      facts,
      rules,
    )
  })

  const elsewhereMonths = schedule.insurance.filter((month) => month.elsewhere > 0 && month.employee === 0).length
  const settlement = payroll.length === 0 ? null : annualSettlement({ taxYear: year, months: payroll, allowanceMonthsElsewhere: elsewhereMonths, basis: BASIS }, facts, rules)

  const rent = schedule.rentMonths.map((part): RentPart => {
    const amount = prorated(part.rent.amount, part.days, part.daysInMonth)
    const rentRule = rules('hr.pit.rent', lastDayOf(part.month))
    const { flatExpenseShare, taxRate } = rentRule.value
    const paid = tracedFigure(part.days === part.daysInMonth ? `Rent, ${monthLabel(part.month)}` : `Rent for ${part.days} of ${part.daysInMonth} days, ${monthLabel(part.month)}`, amount, BASIS, [rentRule.citation])
    const taxed = subtractMoney(amount, atRate(amount, flatExpenseShare.basisPoints))
    const tax = tracedFigure(
      `Rent tax, ${monthLabel(part.month)}: ${percentText(taxRate.basisPoints)} of the rent less ${percentText(flatExpenseShare.basisPoints)} flat expenses`,
      atRate(taxed, taxRate.basisPoints),
      BASIS,
      [rentRule.citation],
      [paid],
    )
    return { month: part.month, rent: paid, tax }
  })

  return { schedule, payroll, settlement, rent, own: boardOnlyContributions(schedule, facts, rules), warnings }
}

interface CapSplit {
  readonly item: string
  readonly month: MonthKey
  readonly within: Money
  readonly over: Money
  readonly rules: readonly RuleCitation[]
}

/** Each tax-free payment split at its yearly cap, the earlier payments of an item filling the cap first. */
function splitAtCaps(schedule: ScenarioSchedule, usage: ReturnType<typeof nontaxableUsage>): CapSplit[] {
  const left = new Map(usage.map((entry) => [entry.payment, entry.cap?.amount ?? null]))
  return [...schedule.nontaxable]
    .sort((earlier, later) => earlier.month.localeCompare(later.month) || earlier.item.sheetRow - later.item.sheetRow)
    .map((plan) => {
      const cap = left.get(plan.item.item) ?? null
      const within = cap === null ? plan.item.amount : ((plan.item.amount < cap ? plan.item.amount : cap) as Money)
      if (cap !== null) {
        left.set(plan.item.item, subtractMoney(cap, within))
      }
      const rulesOfItem = usage.find((entry) => entry.payment === plan.item.item)?.excess.rules ?? []
      return { item: plan.item.item, month: plan.month, within, over: subtractMoney(plan.item.amount, within), rules: rulesOfItem }
    })
}

/** Pension and health a director pays personally on the board member base for the days nothing else insures him, prorated by calendar days. */
function boardOnlyContributions(schedule: ScenarioSchedule, facts: EmployeeFacts, rules: RuleSource): OwnContributions {
  const months = schedule.insurance
    .filter((month) => month.boardOnly > 0)
    .map((month) => {
      const day = firstDayOf(month.month)
      const baseRule = rules('hr.contrib.board-only-base', day)
      const rateRule = rules('hr.contrib.rates', day)
      const basisRule = rules('hr.contrib.insurance-basis', day)
      const citations = [basisRule.citation, baseRule.citation]
      const base = tracedFigure(
        month.boardOnly === month.days ? `Board member base, ${monthLabel(month.month)}` : `Board member base for ${month.boardOnly} of ${month.days} days, ${monthLabel(month.month)}`,
        prorated(baseRule.value.monthlyBase.cents, month.boardOnly, month.days),
        BASIS,
        citations,
      )
      const rates = rateRule.value
      const pillarOneRate = facts.pensionPillarTwo ? rates.pillarOneRateWithPillarTwo.basisPoints : rates.pillarOneRateWithoutPillarTwo.basisPoints
      const at = (label: string, rate: Rate) => tracedFigure(`${label} at ${percentText(rate)}, ${monthLabel(month.month)}`, atRate(base.amount, rate), BASIS, [rateRule.citation, ...citations], [base])
      return {
        pillarOne: at('Pension pillar I', pillarOneRate),
        pillarTwo: at('Pension pillar II', facts.pensionPillarTwo ? rates.pillarTwoRate.basisPoints : (0 as Rate)),
        health: at('Health insurance', rates.healthRate.basisPoints),
      }
    })
  const pillarOne = summed('Paid yourself as a board member only', months.map((month) => month.pillarOne), BASIS)
  const pillarTwo = summed('Paid yourself as a board member only', months.map((month) => month.pillarTwo), BASIS)
  const health = summed('Paid yourself as a board member only', months.map((month) => month.health), BASIS)
  return { pillarOne, pillarTwo, health, total: summed('Contributions paid personally', [pillarOne, pillarTwo, health], BASIS) }
}
