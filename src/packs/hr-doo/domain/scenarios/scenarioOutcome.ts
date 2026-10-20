import type { OwnerPayScenario } from '../../../../features/workbook/domain/ownerPayScenarios'
import { addDays, civilDate } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { firstDayOf, lastDayOf } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { monthLabel } from '../../../../shared/calendar/monthLabel'
import { ZERO, moneyFromCents, subtractMoney, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { ruleValue } from '../../ruleset/ruleset'
import { isWatchedConfidence } from '../../ruleset/schema'
import type { Rate, RuleCitation } from '../../ruleset/schema'
import type { TracedFigure } from '../../ruleset/tracedFigure'
import { citLiability, taxPeriodOf } from '../cit/citLiability'
import type { TracedRate } from '../cit/citLiability'
import { taxBase } from '../cit/taxBase'
import { clawbackExposure } from '../grants/grantRelease'
import { annualSettlement } from '../payroll/annualSettlement'
import type { AnnualSettlement } from '../payroll/annualSettlement'
import type { EmployeeFacts } from '../payroll/incomeTax'
import { nontaxableUsage } from '../payroll/nontaxableUsage'
import { atRate, deducted, dividedRounded, percentText, prorated, rulesOf, summed, tracedFigure } from '../payroll/payrollArithmetic'
import type { RuleSource } from '../payroll/payrollArithmetic'
import { payrollMonth } from '../payroll/payrollMonth'
import type { NontaxablePayment, PayrollMonth } from '../payroll/payrollMonth'
import type { ScenarioCompany } from './scenarioCompany'
import { scenarioGuards } from './scenarioGuards'
import { scenarioSchedule } from './scenarioSchedule'
import type { ScenarioSchedule } from './scenarioSchedule'

/** Something about a scenario to weigh before choosing it. Each carries the figures it rests on. */
export type ScenarioWarning =
  | { readonly kind: 'below-floor'; readonly sheetRow: number; readonly agreed: Money; readonly floor: TracedFigure }
  | { readonly kind: 'cap-exceeded'; readonly item: string; readonly sheetRows: readonly number[]; readonly paid: TracedFigure; readonly cap: TracedFigure; readonly excess: TracedFigure }
  | { readonly kind: 'salary-dropped'; readonly grant: string; readonly from: CivilDate; readonly requiredUntil: CivilDate; readonly atRisk: TracedFigure | null }
  | { readonly kind: 'dividend-above-capacity'; readonly dividend: TracedFigure; readonly distributable: TracedFigure }
  | { readonly kind: 'net-assets-below-capital'; readonly netAssetsAfter: TracedFigure; readonly shareCapital: TracedFigure }
  | { readonly kind: 'cash-short'; readonly cashAfter: TracedFigure }

/** What a scenario rests on that the figures cannot show, so a person can check it holds. */
export type ScenarioNote =
  | { readonly kind: 'tax-free-basis'; readonly item: string; readonly sheetRow: number }
  | { readonly kind: 'rent-basis' }
  | { readonly kind: 'board-only' }
  | { readonly kind: 'insured-elsewhere' }

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

  const own = boardOnlyContributions(schedule, facts, rules)
  const elsewhereMonths = schedule.insurance.filter((month) => month.elsewhere > 0 && month.employee === 0).length
  const settlement = payroll.length === 0 ? null : annualSettlement({ taxYear: year, months: payroll, allowanceMonthsElsewhere: elsewhereMonths, basis: BASIS }, facts, rules)

  const rentParts = schedule.rentMonths.map((part) => {
    const amount = prorated(part.rent.amount, part.days, part.daysInMonth)
    const rentRule = rules('hr.pit.rent', lastDayOf(part.month))
    const { flatExpenseShare, taxRate } = rentRule.value
    const rent = tracedFigure(part.days === part.daysInMonth ? `Rent, ${monthLabel(part.month)}` : `Rent for ${part.days} of ${part.daysInMonth} days, ${monthLabel(part.month)}`, amount, BASIS, [rentRule.citation])
    const taxed = subtractMoney(amount, atRate(amount, flatExpenseShare.basisPoints))
    const tax = tracedFigure(
      `Rent tax, ${monthLabel(part.month)}: ${percentText(taxRate.basisPoints)} of the rent less ${percentText(flatExpenseShare.basisPoints)} flat expenses`,
      atRate(taxed, taxRate.basisPoints),
      BASIS,
      [rentRule.citation],
      [rent],
    )
    return { rent, tax }
  })
  const rent = summed('Rent paid to you', rentParts.map((part) => part.rent), BASIS)
  const rentTax = summed('Rent tax', rentParts.map((part) => part.tax), BASIS)
  const rentAfterTax = summed('Rent after the rent tax', [rent, deducted(rentTax)], BASIS)

  const byMonth = (pick: (month: PayrollMonth) => TracedFigure, label: string) =>
    summed(label, payroll.map((month) => ({ ...pick(month), label: `${pick(month).label}, ${monthLabel(month.workedMonth)}` })), BASIS)
  const grossTwo = byMonth((month) => month.employerCost, 'Gross II, the salary and health on top')
  const taxFree = byMonth((month) => month.nontaxablePayments, 'Tax-free items within their caps')
  const netSalary = byMonth((month) => month.net, 'Net salary')
  const deductibleOwnerPay = summed('Owner pay the corporate tax allows', [grossTwo, taxFree, rent], BASIS)

  const input = company.taxBaseInput
  const period = taxPeriodOf(year, company.registered)
  const withPay = taxBase(
    {
      ...input,
      year,
      expenses: tracedFigure('PD line 2, expenses with this owner pay', sumMoney([input.expenses.amount, deductibleOwnerPay.amount]), BASIS, rulesOf([input.expenses, deductibleOwnerPay]), [
        input.expenses,
        deductibleOwnerPay,
      ]),
    },
    rules,
  )
  const withoutPay = taxBase({ ...input, year }, rules)
  const liability = citLiability(withPay, period, null, rules)
  const corporateTax = liability.liability
  const corporateTaxWithoutOwnerPay = { ...citLiability(withoutPay, period, null, rules).liability, label: 'Corporate tax with no owner pay deducted' }
  const corporateTaxSaved = summed('Corporate tax the deductible owner pay saves', [corporateTaxWithoutOwnerPay, deducted(corporateTax)], BASIS)
  const profitBeforeTax = withPay.profitBeforeTax
  const profitAfterTax = summed('Profit after tax', [profitBeforeTax, deducted(corporateTax)], BASIS)

  const dividend = dividendOf(schedule, company, profitAfterTax, year, rules)
  if (schedule.dividend !== null && schedule.dividend.amount !== 'max' && dividend.gross.amount > dividend.distributable.amount) {
    warnings.push({ kind: 'dividend-above-capacity', dividend: dividend.gross, distributable: dividend.distributable })
  }
  if (dividend.netAssetsAfter.amount < company.shareCapital.amount) {
    warnings.push({ kind: 'net-assets-below-capital', netAssetsAfter: dividend.netAssetsAfter, shareCapital: company.shareCapital })
  }

  const settlementRefund = settlement === null ? tracedFigure('No annual settlement, as no salary is paid', ZERO, BASIS, []) : settlement.refund
  const ownContributions = deducted({ ...own.total, label: 'Contributions you pay yourself as a board member only' })
  const netToOwner = summed('Net to you', [netSalary, taxFree, rentAfterTax, dividend.net, settlementRefund, ownContributions], BASIS)
  const companyCost = summed('Total cost to the company', [grossTwo, taxFree, rent, dividend.gross, corporateTax], BASIS)

  const taxes: ScenarioTaxes = {
    pensionPillarOne: summed('Pension pillar I, your pension rights', [byMonth((month) => month.pensionPillarOne, 'On the salary'), own.pillarOne], BASIS),
    pensionPillarTwo: summed('Pension pillar II, your own savings', [byMonth((month) => month.pensionPillarTwo, 'On the salary'), own.pillarTwo], BASIS),
    health: summed('Health insurance', [byMonth((month) => month.health, 'On the salary'), own.health], BASIS),
    incomeTaxWithheld: byMonth((month) => month.incomeTax, 'Income tax withheld in the months'),
    settlementChange:
      settlement === null
        ? tracedFigure('No annual settlement', ZERO, BASIS, [])
        : { ...deducted(settlement.refund), label: settlement.refund.amount >= 0 ? 'Annual settlement, refunded to you' : 'Annual settlement, extra tax to pay' },
    youthRelief: settlement?.youthRelief ?? tracedFigure('No youth relief without a salary', ZERO, BASIS, []),
    rentTax,
    dividendTax: dividend.tax,
    corporateTax,
  }
  const stateTake = summed(
    'Taken by the state, pillar II apart',
    [taxes.pensionPillarOne, taxes.health, taxes.incomeTaxWithheld, taxes.settlementChange, taxes.rentTax, taxes.dividendTax, taxes.corporateTax],
    BASIS,
  )
  const profitBeforeOwnerPay = company.profitBeforeOwnerPay
  const keptInCompany = summed('Kept in the company', [profitBeforeOwnerPay, deducted(companyCost)], BASIS)
  const netPerHundred =
    profitBeforeOwnerPay.amount > 0
      ? tracedFigure('Net to you of each 100.00 of profit before owner pay', moneyFromCents(dividedRounded(netToOwner.amount * 10_000, profitBeforeOwnerPay.amount)), BASIS, rulesOf([netToOwner]), [
          netToOwner,
          profitBeforeOwnerPay,
        ])
      : null

  const cashAfter = summed("Cash after the year's owner pay, corporate tax and the dividend paid in cash", [
    company.cashBeforeOwnerPay,
    deducted(deductibleOwnerPay),
    deducted(corporateTax),
    deducted(dividend.cashOut),
  ], BASIS)
  if (cashAfter.amount < 0) {
    warnings.push({ kind: 'cash-short', cashAfter })
  }
  warnings.push(...salaryDropped(schedule, company))

  const notes: ScenarioNote[] = [
    ...schedule.nontaxable.map((plan): ScenarioNote => ({ kind: 'tax-free-basis', item: plan.item.item, sheetRow: plan.item.sheetRow })),
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
function boardOnlyContributions(schedule: ScenarioSchedule, facts: EmployeeFacts, rules: RuleSource) {
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

function dividendOf(schedule: ScenarioSchedule, company: ScenarioCompany, profitAfterTax: TracedFigure, year: number, rules: RuleSource): ScenarioDividend {
  const yearEnd = civilDate(year, 12, 31)
  const distributableRule = rules('hr.ztd.distributable-profit', yearEnd)
  const protection = rules('hr.ztd.capital-protection', yearEnd)
  const distributableSteps = [profitAfterTax, company.retainedBroughtIn]
  const distributable = tracedFigure('Distributable profit', sumMoney(distributableSteps.map((step) => step.amount)), BASIS, [distributableRule.citation, ...rulesOf(distributableSteps)], distributableSteps)
  const netAssetsBefore = summed('Net assets at the year end, before the payout', [company.shareCapital, company.reserves, distributable], BASIS)
  const room = subtractMoney(netAssetsBefore.amount, company.shareCapital.amount)
  const most = distributable.amount < room ? distributable.amount : room
  const maxPayout = tracedFigure('The most the year can pay out with the share capital still covered', most > 0 ? most : ZERO, BASIS, [distributableRule.citation, protection.citation], [
    distributable,
    tracedFigure('Net assets above the share capital', room, BASIS, [protection.citation], [netAssetsBefore, deducted(company.shareCapital)]),
  ])
  const chosen = schedule.dividend
  const ofYear = profitAfterTax.amount < maxPayout.amount ? profitAfterTax.amount : maxPayout.amount
  const gross =
    chosen === null
      ? tracedFigure('No dividend', ZERO, BASIS, [])
      : chosen.amount === 'max'
        ? tracedFigure("Dividend of the year's profit after tax, as far as the payout limit allows", ofYear > 0 ? ofYear : ZERO, BASIS, maxPayout.rules, [profitAfterTax, maxPayout])
        : tracedFigure('Dividend', chosen.amount, BASIS, [distributableRule.citation])
  const taxRule = rules('hr.pit.dividend', civilDate(year + 1, 1, 1))
  const tax = tracedFigure(`Dividend tax at ${percentText(taxRule.value.rate.basisPoints)}, withheld at payout`, atRate(gross.amount, taxRule.value.rate.basisPoints), BASIS, [taxRule.citation], [gross])
  const net = summed('Dividend after its tax', [gross, deducted(tax)], BASIS)
  const owed = company.owedByOwner.amount > 0 ? company.owedByOwner.amount : ZERO
  const setOff = tracedFigure('Of it, set off against what you owe the company', net.amount < owed ? net.amount : owed, BASIS, [], [net, company.owedByOwner])
  const cashOut = summed('Dividend paid in cash, its tax included', [tax, net, deducted(setOff)], BASIS)
  const netAssetsAfter = summed('Net assets after the payout', [netAssetsBefore, deducted(gross)], BASIS)
  return { distributable, netAssetsBefore, maxPayout, gross, tax, net, setOff, cashOut, netAssetsAfter }
}

/** The first day before a grant's employment date that the scenario pays no salary, for each grant still binding in the year. */
function salaryDropped(schedule: ScenarioSchedule, company: ScenarioCompany): ScenarioWarning[] {
  const yearStart = civilDate(schedule.year, 1, 1)
  const yearEnd = civilDate(schedule.year, 12, 31)
  return company.grants.flatMap((grant): ScenarioWarning[] => {
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

