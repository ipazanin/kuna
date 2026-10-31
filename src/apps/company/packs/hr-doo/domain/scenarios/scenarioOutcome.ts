import type { Grant } from '../grants/grants'
import type { OwnerPayScenario } from './ownerPayScenarios'
import { addDays, civilDate } from '../../../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../../../shared/calendar/civilDate'
import { monthLabel } from '../../../../../../shared/calendar/monthLabel'
import { ZERO, dividedRounded, moneyFromCents, subtractMoney, sumMoney } from '../../../../../../shared/money/money'
import type { Money } from '../../../../../../shared/money/money'
import { ruleValue } from '../../ruleset/ruleset'
import { isWatchedConfidence } from '../../ruleset/schema'
import type { RuleCitation } from '../../ruleset/schema'
import type { TracedFigure } from '../../ruleset/tracedFigure'
import { citLiability, taxPeriodOf } from '../cit/citLiability'
import type { TracedRate } from '../cit/citLiability'
import { taxBase } from '../cit/taxBase'
import { clawbackExposure } from '../grants/grantRelease'
import type { AnnualSettlement } from '../payroll/annualSettlement'
import type { EmployeeFacts } from '../payroll/incomeTax'
import { atRate, deducted, percentText, rulesOf, summed, tracedFigure } from '../payroll/payrollArithmetic'
import type { RuleSource } from '../payroll/payrollArithmetic'
import type { PayrollMonth } from '../payroll/payrollMonth'
import { HUNDRED } from './marginalEuro'
import type { ScenarioCompany } from './scenarioCompany'
import { scenarioGuards } from './scenarioGuards'
import { scenarioPay } from './scenarioPay'
import type { ScenarioSchedule } from './scenarioSchedule'
import { words } from './words'

/** Something about a scenario to weigh before choosing it. Each carries the figures it rests on. */
export type ScenarioWarning =
  | { readonly kind: 'below-floor'; readonly agreed: Money; readonly floor: TracedFigure }
  | { readonly kind: 'cap-exceeded'; readonly item: string; readonly paid: TracedFigure; readonly cap: TracedFigure; readonly excess: TracedFigure }
  | { readonly kind: 'salary-dropped'; readonly grant: string; readonly from: CivilDate; readonly requiredUntil: CivilDate; readonly atRisk: TracedFigure | null }
  | { readonly kind: 'dividend-above-capacity'; readonly dividend: TracedFigure; readonly distributable: TracedFigure }
  | { readonly kind: 'net-assets-below-capital'; readonly netAssetsAfter: TracedFigure; readonly shareCapital: TracedFigure }
  | { readonly kind: 'cash-short'; readonly cashAfter: TracedFigure }

/** What a scenario rests on that the figures cannot show, so a person can check it holds. */
export type ScenarioNote = { readonly kind: 'tax-free-basis'; readonly item: string } | { readonly kind: 'rent-basis' } | { readonly kind: 'board-only' } | { readonly kind: 'insured-elsewhere' }

export interface ScenarioTaxes {
  readonly pensionPillarOne: TracedFigure
  /** The owner's own pension savings, shown apart from what the state takes. */
  readonly pensionPillarTwo: TracedFigure
  readonly health: TracedFigure
  readonly incomeTaxWithheld: TracedFigure
  /** Extra tax from the annual settlement, or a refund when negative. */
  readonly settlementChange: TracedFigure
  /** Already inside the settlement change, shown for what it is worth. */
  readonly youthRelief: TracedFigure
  readonly rentTax: TracedFigure
  readonly dividendTax: TracedFigure
  readonly corporateTax: TracedFigure
}

export interface ScenarioDividend {
  readonly distributable: TracedFigure
  readonly netAssetsBefore: TracedFigure
  readonly maxPayout: TracedFigure
  readonly gross: TracedFigure
  readonly tax: TracedFigure
  readonly net: TracedFigure
  /** What the net dividend settles of what the owner owes, instead of being paid out. */
  readonly setOff: TracedFigure
  /** The net paid in cash and the dividend tax. */
  readonly cashOut: TracedFigure
  readonly netAssetsAfter: TracedFigure
}

/** One owner pay mix worked through for its year: what reaches the owner, what it costs the company and what the state takes. */
export interface ScenarioOutcome {
  readonly scenario: OwnerPayScenario
  readonly company: ScenarioCompany
  readonly payroll: readonly PayrollMonth[]
  /** Null when the scenario pays no salary. */
  readonly settlement: AnnualSettlement | null
  readonly profitBeforeOwnerPay: TracedFigure
  readonly netSalary: TracedFigure
  readonly taxFree: TracedFigure
  readonly rent: TracedFigure
  readonly rentAfterTax: TracedFigure
  readonly settlementRefund: TracedFigure
  /** Contributions a board member who is not employed pays personally, read negative here. */
  readonly ownContributions: TracedFigure
  readonly netToOwner: TracedFigure
  readonly grossTwo: TracedFigure
  /** Salary, tax-free items and rent, which the corporate tax allows. */
  readonly deductibleOwnerPay: TracedFigure
  readonly corporateTaxWithoutOwnerPay: TracedFigure
  readonly corporateTaxSaved: TracedFigure
  readonly corporateRate: TracedRate
  readonly profitBeforeTax: TracedFigure
  readonly profitAfterTax: TracedFigure
  readonly dividend: ScenarioDividend
  readonly companyCost: TracedFigure
  readonly taxes: ScenarioTaxes
  /** Everything the state takes but pillar II, which is the owner's own. */
  readonly stateTake: TracedFigure
  readonly keptInCompany: TracedFigure
  /** Net to the owner of each 100.00 of profit before owner pay. Null when there is no profit. */
  readonly netPerHundred: TracedFigure | null
  readonly cashAfter: TracedFigure
  readonly warnings: readonly ScenarioWarning[]
  readonly notes: readonly ScenarioNote[]
  /** The rule versions behind these figures that the ruleset marks estimated, pending or unconfirmed, each once. */
  readonly watched: readonly RuleCitation[]
}

const BASIS = 'plan'

/**
 * Works a scenario through its year: each salary month through the payroll, the annual settlement,
 * contributions a board member pays personally, the rent and its tax, the corporate tax with the
 * deductible owner pay and without it, and the dividend out of what is left with its tax. A
 * dividend of `max` pays out the year's own profit after tax as far as the distributable amount and
 * the share capital allow, and leaves earlier years' retained earnings alone. A scenario a guard
 * stops is refused. Salary is paid in the month worked, and a dividend once the
 * year's statements are adopted. Planning figures only.
 */
export function scenarioOutcome(scenario: OwnerPayScenario, company: ScenarioCompany, facts: EmployeeFacts, rules: RuleSource = ruleValue): ScenarioOutcome {
  const guards = scenarioGuards(scenario, rules)
  if (guards.length > 0) {
    throw new RangeError(`${scenario.slug} cannot be worked out. ${guards.map((guard) => guard.reason).join(' ')}`)
  }
  const { year } = scenario
  const pay = scenarioPay(scenario, facts, rules)
  const { schedule, payroll, settlement, own } = pay
  const warnings: ScenarioWarning[] = [...pay.warnings]

  const rent = summed(
    words.outcome.rentPaid,
    pay.rent.map((part) => part.rent),
    BASIS,
  )
  const rentTax = summed(
    words.outcome.rentTax,
    pay.rent.map((part) => part.tax),
    BASIS,
  )
  const rentAfterTax = summed(words.outcome.rentAfterTax, [rent, deducted(rentTax)], BASIS)

  const byMonth = (pick: (month: PayrollMonth) => TracedFigure, label: string) =>
    summed(
      label,
      payroll.map((month) => ({ ...pick(month), label: words.outcome.inMonth(pick(month).label, monthLabel(month.workedMonth)) })),
      BASIS,
    )
  const grossTwo = byMonth((month) => month.employerCost, words.outcome.grossTwo)
  const taxFree = byMonth((month) => month.nontaxablePayments, words.outcome.taxFree)
  const netSalary = byMonth((month) => month.net, words.outcome.netSalary)
  const deductibleOwnerPay = summed(words.outcome.deductible, [grossTwo, taxFree, rent], BASIS)

  const input = company.taxBaseInput
  const period = taxPeriodOf(year, company.registered)
  const withPay = taxBase(
    {
      ...input,
      year,
      expenses: tracedFigure(words.outcome.expensesWithPay, sumMoney([input.expenses.amount, deductibleOwnerPay.amount]), BASIS, rulesOf([input.expenses, deductibleOwnerPay]), [
        input.expenses,
        deductibleOwnerPay,
      ]),
    },
    rules,
  )
  const withoutPay = taxBase({ ...input, year }, rules)
  const liability = citLiability(withPay, period, null, rules)
  const corporateTax = liability.liability
  const corporateTaxWithoutOwnerPay = { ...citLiability(withoutPay, period, null, rules).liability, label: words.outcome.taxWithoutPay }
  const corporateTaxSaved = summed(words.outcome.taxSaved, [corporateTaxWithoutOwnerPay, deducted(corporateTax)], BASIS)
  const profitBeforeTax = withPay.profitBeforeTax
  const profitAfterTax = summed(words.outcome.profitAfterTax, [profitBeforeTax, deducted(corporateTax)], BASIS)

  const dividend = dividendOf(schedule, company, profitAfterTax, year, rules)
  if (schedule.dividend !== null && schedule.dividend.amount !== 'max' && dividend.gross.amount > dividend.distributable.amount) {
    warnings.push({ kind: 'dividend-above-capacity', dividend: dividend.gross, distributable: dividend.distributable })
  }
  if (dividend.netAssetsAfter.amount < company.shareCapital.amount) {
    warnings.push({ kind: 'net-assets-below-capital', netAssetsAfter: dividend.netAssetsAfter, shareCapital: company.shareCapital })
  }

  const settlementRefund = settlement === null ? tracedFigure(words.outcome.noSettlement, ZERO, BASIS, []) : settlement.refund
  const ownContributions = deducted({ ...own.total, label: words.outcome.ownContributions })
  const netToOwner = summed(words.outcome.netToYou, [netSalary, taxFree, rentAfterTax, dividend.net, settlementRefund, ownContributions], BASIS)
  const companyCost = summed(words.outcome.companyCost, [grossTwo, taxFree, rent, dividend.gross, corporateTax], BASIS)

  const taxes: ScenarioTaxes = {
    pensionPillarOne: summed(words.outcome.pillarOne, [byMonth((month) => month.pensionPillarOne, words.outcome.onSalary), own.pillarOne], BASIS),
    pensionPillarTwo: summed(words.outcome.pillarTwo, [byMonth((month) => month.pensionPillarTwo, words.outcome.onSalary), own.pillarTwo], BASIS),
    health: summed(words.outcome.health, [byMonth((month) => month.health, words.outcome.onSalary), own.health], BASIS),
    incomeTaxWithheld: byMonth((month) => month.incomeTax, words.outcome.incomeTaxWithheld),
    settlementChange:
      settlement === null
        ? tracedFigure(words.outcome.noAnnualSettlement, ZERO, BASIS, [])
        : { ...deducted(settlement.refund), label: settlement.refund.amount >= 0 ? words.outcome.refunded : words.outcome.extraTax },
    youthRelief: settlement?.youthRelief ?? tracedFigure(words.outcome.noYouthRelief, ZERO, BASIS, []),
    rentTax,
    dividendTax: dividend.tax,
    corporateTax,
  }
  const stateTake = summed(
    words.outcome.stateTake,
    [taxes.pensionPillarOne, taxes.health, taxes.incomeTaxWithheld, taxes.settlementChange, taxes.rentTax, taxes.dividendTax, taxes.corporateTax],
    BASIS,
  )
  const profitBeforeOwnerPay = company.profitBeforeOwnerPay
  const keptInCompany = summed(words.outcome.kept, [profitBeforeOwnerPay, deducted(companyCost)], BASIS)
  const netPerHundred =
    profitBeforeOwnerPay.amount > 0
      ? tracedFigure(words.outcome.perHundred(HUNDRED), moneyFromCents(dividedRounded(netToOwner.amount * HUNDRED, profitBeforeOwnerPay.amount)), BASIS, rulesOf([netToOwner]), [
          netToOwner,
          profitBeforeOwnerPay,
        ])
      : null

  const cashAfter = summed(words.outcome.cashAfter, [company.cashBeforeOwnerPay, deducted(deductibleOwnerPay), deducted(corporateTax), deducted(dividend.cashOut)], BASIS)
  if (cashAfter.amount < 0) {
    warnings.push({ kind: 'cash-short', cashAfter })
  }
  warnings.push(...salaryDropped(schedule, company.grants))

  const notes: ScenarioNote[] = [
    ...schedule.nontaxable.map((plan): ScenarioNote => ({ kind: 'tax-free-basis', item: plan.item.item })),
    ...(rent.amount > 0 ? [{ kind: 'rent-basis' } as const] : []),
    ...(schedule.insurance.some((month) => month.boardOnly > 0) ? [{ kind: 'board-only' } as const] : []),
    ...(schedule.insurance.some((month) => month.elsewhere > 0) ? [{ kind: 'insured-elsewhere' } as const] : []),
  ]

  return {
    scenario,
    company,
    payroll,
    settlement,
    profitBeforeOwnerPay,
    netSalary,
    taxFree,
    rent,
    rentAfterTax,
    settlementRefund,
    ownContributions,
    netToOwner,
    grossTwo,
    deductibleOwnerPay,
    corporateTaxWithoutOwnerPay,
    corporateTaxSaved,
    corporateRate: liability.rate,
    profitBeforeTax,
    profitAfterTax,
    dividend,
    companyCost,
    taxes,
    stateTake,
    keptInCompany,
    netPerHundred,
    cashAfter,
    warnings,
    notes,
    watched: watchedIn([
      netToOwner,
      companyCost,
      stateTake,
      taxes.pensionPillarTwo,
      ...payroll.map((month) => month.taxableIncome),
      ...(settlement === null ? [] : [settlement.annualTax, settlement.taxableIncome]),
    ]),
  }
}

function dividendOf(schedule: ScenarioSchedule, company: ScenarioCompany, profitAfterTax: TracedFigure, year: number, rules: RuleSource): ScenarioDividend {
  const yearEnd = civilDate(year, 12, 31)
  const distributableRule = rules('hr.ztd.distributable-profit', yearEnd)
  const protection = rules('hr.ztd.capital-protection', yearEnd)
  const distributableSteps = [profitAfterTax, company.retainedBroughtIn]
  const distributable = tracedFigure(
    words.outcome.distributable,
    sumMoney(distributableSteps.map((step) => step.amount)),
    BASIS,
    [distributableRule.citation, ...rulesOf(distributableSteps)],
    distributableSteps,
  )
  const netAssetsBefore = summed(words.outcome.netAssetsBefore, [company.shareCapital, company.reserves, distributable], BASIS)
  const room = subtractMoney(netAssetsBefore.amount, company.shareCapital.amount)
  const most = distributable.amount < room ? distributable.amount : room
  const maxPayout = tracedFigure(
    words.outcome.maxPayout,
    most > 0 ? most : ZERO,
    BASIS,
    [distributableRule.citation, protection.citation],
    [distributable, tracedFigure(words.outcome.aboveCapital, room, BASIS, [protection.citation], [netAssetsBefore, deducted(company.shareCapital)])],
  )
  const chosen = schedule.dividend
  const ofYear = profitAfterTax.amount < maxPayout.amount ? profitAfterTax.amount : maxPayout.amount
  const gross =
    chosen === null
      ? tracedFigure(words.outcome.noDividend, ZERO, BASIS, [])
      : chosen.amount === 'max'
        ? tracedFigure(words.outcome.maxDividend, ofYear > 0 ? ofYear : ZERO, BASIS, maxPayout.rules, [profitAfterTax, maxPayout])
        : tracedFigure(words.outcome.dividend, chosen.amount, BASIS, [distributableRule.citation])
  const taxRule = rules('hr.pit.dividend', civilDate(year + 1, 1, 1))
  const tax = tracedFigure(words.outcome.dividendTax(percentText(taxRule.value.rate.basisPoints)), atRate(gross.amount, taxRule.value.rate.basisPoints), BASIS, [taxRule.citation], [gross])
  const net = summed(words.outcome.dividendNet, [gross, deducted(tax)], BASIS)
  const owed = company.owedByOwner.amount > 0 ? company.owedByOwner.amount : ZERO
  const setOff = tracedFigure(words.outcome.setOff, net.amount < owed ? net.amount : owed, BASIS, [], [net, company.owedByOwner])
  const cashOut = summed(words.outcome.cashOut, [tax, net, deducted(setOff)], BASIS)
  const netAssetsAfter = summed(words.outcome.netAssetsAfter, [netAssetsBefore, deducted(gross)], BASIS)
  return { distributable, netAssetsBefore, maxPayout, gross, tax, net, setOff, cashOut, netAssetsAfter }
}

/** The first day before a grant's employment date that the scenario pays no salary, for each grant still binding in the year. */
export function salaryDropped(schedule: ScenarioSchedule, grants: readonly Grant[]): Extract<ScenarioWarning, { readonly kind: 'salary-dropped' }>[] {
  const yearStart = civilDate(schedule.year, 1, 1)
  const yearEnd = civilDate(schedule.year, 12, 31)
  return grants.flatMap((grant): Extract<ScenarioWarning, { readonly kind: 'salary-dropped' }>[] => {
    const until = grant.employmentRequiredUntil
    if (until === null || until < yearStart) {
      return []
    }
    const last = until < yearEnd ? until : yearEnd
    for (let day = grant.received > yearStart ? grant.received : yearStart; day <= last; day = addDays(day, 1)) {
      if (schedule.salaryOn(day) === null) {
        return [{ kind: 'salary-dropped', grant: grant.slug, from: day, requiredUntil: until, atRisk: clawbackExposure(grant, day)?.amount ?? null }]
      }
    }
    return []
  })
}

/** Every rule version marked estimated, pending or unconfirmed anywhere in the figures' build-ups, each once. */
function watchedIn(figures: readonly TracedFigure[]): RuleCitation[] {
  const found = new Map<string, RuleCitation>()
  const walk = (figure: TracedFigure): void => {
    for (const citation of figure.rules) {
      if (isWatchedConfidence(citation.confidence)) {
        found.set(`${citation.ruleId} ${citation.validFrom}`, citation)
      }
    }
    figure.steps.forEach(walk)
  }
  figures.forEach(walk)
  return [...found.values()]
}
