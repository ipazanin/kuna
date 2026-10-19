import { drillToTransactions } from '../../../../features/filters/domain/drillTarget'
import type { Transaction, Workbook } from '../../../../features/workbook/domain/workbook'
import { civilDate, yearOf } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { addMonths, lastDayOf, monthKey, monthOf } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { monthLabel } from '../../../../shared/calendar/monthLabel'
import { ZERO, negateMoney, subtractMoney, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { ruleValue } from '../../ruleset/ruleset'
import type { RuleCitation } from '../../ruleset/schema'
import type { TracedFigure } from '../../ruleset/tracedFigure'
import { withDrill } from '../accrual/accrualAdjustment'
import { equityBroughtForward } from '../accrual/accrualBalanceSheet'
import { outstandingFigure } from '../cit/matchCitPayments'
import { cashOnNewestBooking } from '../forecast/forecastCash'
import { monthOfLine } from '../forecast/forecastLines'
import { forecastYear } from '../forecast/forecastYear'
import type { YearForecast } from '../forecast/forecastYear'
import { clawbackExposure } from '../grants/grantRelease'
import { netOwed, ownerAdvances } from '../ownerAdvances'
import { ownerLoans } from '../ownerLoans'
import { PACK_ROLES, categoriesWithRole } from '../packRoles'
import { atRate, deducted, percentText, rulesOf, summed, tracedFigure } from '../payroll/payrollArithmetic'
import type { RuleSource } from '../payroll/payrollArithmetic'

/** The ways the year's profit can go to the owner, which a screen switches between. */
export type PayoutOptionId = 'after-adoption' | 'interim' | 'keep'

export interface PayoutOption {
  readonly id: PayoutOptionId
  readonly label: string
  /** The first day it can be paid. Null when nothing is paid. */
  readonly earliestOn: CivilDate | null
  /** The last day it can be decided or paid. Null when nothing is paid. */
  readonly latestOn: CivilDate | null
  readonly gross: TracedFigure
  readonly dividendTax: TracedFigure
  readonly net: TracedFigure
  /** What the net payout settles of what the owner owes the company, instead of being paid out. */
  readonly setOff: TracedFigure
  /** The net paid out in cash and the dividend tax paid to the state. */
  readonly cashOut: TracedFigure
  /** Cash left after the payout: of the interim cash for an interim payout, otherwise of cash at the year end with December settled and the tax balance paid. */
  readonly cashLeft: TracedFigure
  /** For the interim payout, the cash it is paid from. Null otherwise. */
  readonly cashNow: InterimCash | null
  readonly owedByOwnerAfter: TracedFigure
  /** The yearly benefit in kind on what stays owed while no interest is charged, taxed through payroll. */
  readonly loanBenefitPerYear: TracedFigure
  readonly netAssetsAfter: TracedFigure
  /** Net assets after the payout stay at or above the share capital. */
  readonly capitalProtected: boolean
  /** What the grant's clawback terms put at risk on the first day it can be paid. */
  readonly clawbackExposure: TracedFigure
  /** For the interim payout, the part the year's profit does not cover, which is taxed as the owner's income. Null otherwise. */
  readonly shortfall: TracedFigure | null
  /** What stays in the company as retained earnings for later years. */
  readonly retainedAfter: TracedFigure
}

/** The cash an interim payout is paid from, on the day of the forecast. */
export interface InterimCash {
  /** The bank balance on the newest booking. */
  readonly cash: TracedFigure
  /** Corporate tax and pay for complete months still unpaid, due by the end of the month of the newest booking. */
  readonly fallingDue: TracedFigure
  readonly available: TracedFigure
  /** The largest interim payout, its tax included, that the available cash covers. */
  readonly largestPayout: TracedFigure
}

/** Lines that are not law but weigh on how much to pay out. */
export interface DividendPrudence {
  /** What the grants' clawback terms put at risk at the year end, each with the day it applies until. */
  readonly clawbackExposure: TracedFigure
  readonly cashAtYearEnd: TracedFigure
  /** The corporate tax the year's return leaves to pay on its filing deadline. */
  readonly balanceDue: TracedFigure
  /** December's pay, rent and corporate tax advance, paid in January. Cash at the year end already settles the VAT position. */
  readonly decemberDue: TracedFigure
  readonly cashAfterObligations: TracedFigure
  /** What the owner owes the company on loans, private shares and advances, net, on the day of the forecast. */
  readonly owedByOwner: TracedFigure
  /** Profit is withheld when the position has seriously and lastingly worsened, which the members judge. */
  readonly deterioration: RuleCitation
}

export interface DividendCapacity {
  readonly year: number
  readonly profitAfterTax: TracedFigure
  /** Retained earnings the year starts with, before anything is paid out in it. */
  readonly retainedEarnings: TracedFigure
  readonly lossesBroughtForward: TracedFigure
  /** Profit paid out in the year so far, with its tax. */
  readonly paidOutInYear: TracedFigure
  readonly distributable: TracedFigure
  /** The share capital, which net assets must still cover after a payout. */
  readonly shareCapital: TracedFigure
  readonly netAssetsAtYearEnd: TracedFigure
  /** The distributable amount that leaves the share capital covered, never below nothing. */
  readonly maxPayout: TracedFigure
  /** The last day the members decide on the year's statements and the use of its profit. */
  readonly decideBy: CivilDate
  readonly prudence: DividendPrudence
  readonly options: readonly PayoutOption[]
}

/**
 * What the year's forecast leaves to pay out, and the three ways to do it: one payout once the
 * members adopt the statements, set off against what the owner owes, an interim payout in the year
 * on the profit of its complete months, or keeping it in the company. Distributable profit is the
 * year's profit after tax plus retained earnings, less losses brought forward and what the year has
 * paid out already. Planning figures only.
 */
export function dividendCapacity(year: number, forecast: YearForecast, workbook: Workbook, rules: RuleSource = ruleValue): DividendCapacity {
  if (forecast.year !== year) {
    throw new RangeError(`The forecast is for ${forecast.year}, not ${year}.`)
  }
  const { asOf } = forecast
  const yearEnd = civilDate(year, 12, 31)
  const rows = workbook.transactions.filter((row) => row.date <= asOf)
  const distributableRule = rules('hr.ztd.distributable-profit', yearEnd)
  const protectionRule = rules('hr.ztd.capital-protection', yearEnd)
  if (protectionRule.value.netAssetsFloor.text !== 'share-capital') {
    throw new RangeError(`The capital protection rule in force on ${yearEnd} does not set the floor at the share capital.`)
  }

  const opening = openingEquity(year, forecast, workbook, rules)
  const retainedEarnings = { ...opening.retained, amount: opening.retained.amount > 0 ? opening.retained.amount : ZERO, label: `Retained earnings at the start of ${year}` }
  const lossesBroughtForward = tracedFigure(`Losses brought forward into ${year}`, opening.retained.amount < 0 ? negateMoney(opening.retained.amount) : ZERO, opening.retained.basis, [
    distributableRule.citation,
  ], [opening.retained])
  const paidOutInYear = paidOutIn(year, rows, workbook)
  const distributableSteps = [forecast.profitAfterTax, retainedEarnings, deducted(lossesBroughtForward), deducted(paidOutInYear)]
  const distributable = tracedFigure('Distributable profit', sumMoney(distributableSteps.map((step) => step.amount)), 'ledger', [
    distributableRule.citation,
    ...rulesOf(distributableSteps),
  ], distributableSteps)

  const shareCapital = shareCapitalOf(workbook, year, rules)
  const netAssetsSteps = [shareCapital, opening.reserves, distributable]
  const netAssetsAtYearEnd = summed('Net assets at the year end, before any new payout', netAssetsSteps, 'ledger')
  const protectedPayout = subtractMoney(netAssetsAtYearEnd.amount, shareCapital.amount)
  const maxAmount = distributable.amount < protectedPayout ? distributable.amount : protectedPayout
  const maxPayout = tracedFigure(
    'The most that can be paid out with the share capital still covered',
    maxAmount > 0 ? maxAmount : ZERO,
    'ledger',
    [distributableRule.citation, protectionRule.citation],
    [distributable, tracedFigure('Net assets above the share capital', protectedPayout, 'ledger', [protectionRule.citation], [netAssetsAtYearEnd, deducted(shareCapital)])],
  )

  const deadline = rules('hr.ztd.members-decision-deadline', yearEnd)
  const decideBy = lastDayOf(addMonths(monthKey(year, 12), deadline.value.monthsAfterFinancialYearEnd.count))

  const balanceDue = forecast.liability.balanceDue ?? tracedFigure('PD line 57, not known', ZERO, 'ledger', [])
  const advancesAfterYearEnd = forecast.cit.obligations
    .filter((entry) => entry.obligation.dueOn > yearEnd && entry.outstanding > 0)
    .map(outstandingFigure)
  const decemberDue = summed('December’s pay, rent and corporate tax advance paid in January', [forecast.decemberArrears, ...advancesAfterYearEnd], 'ledger')
  const cashAfterObligations = summed('Cash at the year end with December settled, less the corporate tax balance', [
    forecast.cashAtYearEnd,
    forecast.decemberReceivable,
    deducted(decemberDue),
    deducted(balanceDue),
  ], 'ledger')
  const owed = netOwed(ownerLoans(rows, workbook.categories), ownerAdvances(workbook.ownerAdvances.filter((advance) => advance.date <= asOf), rows, workbook.categories), rows, workbook.categories)
  const owedByOwner = withDrill({ ...tracedFigure('Owed by the owner, net, on', owed.amount > 0 ? owed.amount : ZERO, 'ledger', []), on: asOf }, owed.drill)
  const prudence: DividendPrudence = {
    clawbackExposure: clawbackOn(workbook, yearEnd),
    cashAtYearEnd: forecast.cashAtYearEnd,
    balanceDue,
    decemberDue,
    cashAfterObligations,
    owedByOwner,
    deterioration: rules('hr.ztd.withhold-on-deterioration', yearEnd).citation,
  }

  const payout: PayoutContext = { year, yearEnd, workbook, rules, netAssetsAtYearEnd, shareCapital, distributable, cashAfterObligations, owedByOwner }
  const afterAdoption = payoutOption(payout, {
    id: 'after-adoption',
    label: `One payout once the members adopt the ${year} statements, set off against what the owner owes`,
    earliestOn: civilDate(year + 1, 1, 1),
    latestOn: decideBy,
    gross: maxPayout,
    setsOff: true,
    shortfall: null,
    cashNow: null,
  })
  const interim = interimPayout(payout, forecast, rows, opening.retained, paidOutInYear)
  const keep = payoutOption(payout, {
    id: 'keep',
    label: 'Keep the profit in the company',
    earliestOn: null,
    latestOn: null,
    gross: tracedFigure('Nothing paid out', ZERO, 'ledger', []),
    setsOff: false,
    shortfall: null,
    cashNow: null,
  })

  return {
    year,
    profitAfterTax: forecast.profitAfterTax,
    retainedEarnings,
    lossesBroughtForward,
    paidOutInYear,
    distributable,
    shareCapital,
    netAssetsAtYearEnd,
    maxPayout,
    decideBy,
    prudence,
    options: [afterAdoption, interim, keep],
  }
}

interface PayoutContext {
  readonly year: number
  readonly yearEnd: CivilDate
  readonly workbook: Workbook
  readonly rules: RuleSource
  readonly netAssetsAtYearEnd: TracedFigure
  readonly shareCapital: TracedFigure
  readonly distributable: TracedFigure
  readonly cashAfterObligations: TracedFigure
  readonly owedByOwner: TracedFigure
}

interface PayoutChoice {
  readonly id: PayoutOptionId
  readonly label: string
  readonly earliestOn: CivilDate | null
  readonly latestOn: CivilDate | null
  readonly gross: TracedFigure
  /** Whether the net payout settles what the owner owes before any of it is paid in cash. */
  readonly setsOff: boolean
  readonly shortfall: TracedFigure | null
  /** For an interim payout, the cash it is weighed against instead of cash at the year end. */
  readonly cashNow: InterimCash | null
}

function payoutOption(context: PayoutContext, choice: PayoutChoice): PayoutOption {
  const { rules, owedByOwner } = context
  const ruleDay = choice.earliestOn ?? context.yearEnd
  const taxRule = rules('hr.pit.dividend', ruleDay)
  const gross = choice.gross
  const dividendTax = tracedFigure(`Dividend tax at ${percentText(taxRule.value.rate.basisPoints)}, withheld at payout`, atRate(gross.amount, taxRule.value.rate.basisPoints), 'ledger', [taxRule.citation], [gross])
  const net = tracedFigure('Paid to the owner after the dividend tax', subtractMoney(gross.amount, dividendTax.amount), 'ledger', rulesOf([gross, dividendTax]), [gross, deducted(dividendTax)])
  const settled = choice.setsOff ? (net.amount < owedByOwner.amount ? net.amount : owedByOwner.amount) : ZERO
  const setOff = tracedFigure(choice.setsOff ? 'Set off against what the owner owes' : 'Nothing set off', settled, 'ledger', [], choice.setsOff ? [net, owedByOwner] : [])
  const cashOut = summed('Paid out in cash, the tax included', [dividendTax, net, deducted(setOff)], 'ledger')
  const owedAfter = summed('Owed by the owner after the payout', [owedByOwner, deducted(setOff)], 'ledger')
  const benefitRule = rules('hr.pit.loan-benefit', ruleDay)
  const netAssetsAfter = summed('Net assets after the payout', [context.netAssetsAtYearEnd, deducted(gross)], 'ledger')
  return {
    id: choice.id,
    label: choice.label,
    earliestOn: choice.earliestOn,
    latestOn: choice.latestOn,
    gross,
    dividendTax,
    net,
    setOff,
    cashOut,
    cashLeft: summed('Cash left after the payout', [choice.cashNow === null ? context.cashAfterObligations : choice.cashNow.available, deducted(cashOut)], 'ledger'),
    cashNow: choice.cashNow,
    owedByOwnerAfter: owedAfter,
    loanBenefitPerYear: tracedFigure(
      `A year of benefit in kind at ${percentText(benefitRule.value.minimumInterestRate.basisPoints)} on what stays owed, with no interest charged`,
      atRate(owedAfter.amount, benefitRule.value.minimumInterestRate.basisPoints),
      'ledger',
      [benefitRule.citation],
      [owedAfter],
    ),
    netAssetsAfter,
    capitalProtected: netAssetsAfter.amount >= context.shareCapital.amount,
    clawbackExposure: choice.earliestOn === null ? tracedFigure('Nothing paid out, so nothing at risk from it', ZERO, 'assets', []) : clawbackOn(context.workbook, choice.earliestOn),
    shortfall: choice.shortfall,
    retainedAfter: summed('Kept in the company as retained earnings', [context.distributable, deducted(gross)], 'ledger'),
  }
}

/**
 * An interim payout now, on the profit of the year's complete months after corporate tax at the
 * year's rate, with what was retained and less what the year paid out. The part the year's own
 * distributable profit does not cover is taxed as the owner's income.
 */
function interimPayout(context: PayoutContext, forecast: YearForecast, rows: readonly Transaction[], openingRetained: TracedFigure, paidOut: TracedFigure): PayoutOption {
  const { year, yearEnd, rules, distributable } = context
  const { lastComplete } = forecast.calendar
  const december = monthKey(year, 12)
  const through = lastComplete === null || lastComplete < monthKey(year, 1) ? null : lastComplete > december ? december : lastComplete
  const label = `An interim payout in ${year}`
  if (forecast.asOf > yearEnd || through === null) {
    return payoutOption(context, {
      id: 'interim',
      label,
      earliestOn: null,
      latestOn: null,
      gross: tracedFigure(forecast.asOf > yearEnd ? 'Nothing: the year has ended' : 'Nothing: the year has no complete month for an interim statement', ZERO, 'ledger', []),
      setsOff: false,
      shortfall: null,
      cashNow: null,
    })
  }
  const toDate = summed(
    `Profit before tax to the end of ${monthLabel(through)}`,
    forecast.profitBeforeTax.months.filter((entry) => entry.month <= through).map((entry) => entry.figure),
    'ledger',
  )
  const { rate } = forecast.liability
  const tax = tracedFigure(`Corporate tax on it at ${percentText(rate.basisPoints)}`, atRate(toDate.amount > 0 ? toDate.amount : ZERO, rate.basisPoints), 'ledger', rate.rules, [toDate])
  const interimProfit = summed('Profit after tax in an interim statement', [toDate, deducted(tax)], 'ledger')
  const available = summed('Interim profit and what was retained, less what the year paid out', [interimProfit, openingRetained, deducted(paidOut)], 'ledger')
  const shortfallRule = rules('hr.cit.profit-advance-shortfall', yearEnd)
  const gross = tracedFigure('Interim payout', available.amount > 0 ? available.amount : ZERO, 'ledger', available.rules, [available])
  const covered = distributable.amount > 0 ? distributable.amount : ZERO
  const uncovered = subtractMoney(gross.amount, covered)
  const cashNow = interimCash(forecast, rows, through, gross.amount)
  return payoutOption(context, {
    id: 'interim',
    label,
    earliestOn: forecast.asOf,
    latestOn: yearEnd,
    gross,
    setsOff: false,
    shortfall: tracedFigure('Not covered by the year’s distributable profit, taxed as the owner’s income', uncovered > 0 ? uncovered : ZERO, 'ledger', [shortfallRule.citation], [
      gross,
      deducted(distributable),
    ]),
    cashNow,
  })
}

/**
 * The cash on the newest booking, less the corporate tax due by the end of its month, overdue
 * included, and the pay for the last complete month that the ledger has not paid yet. The dividend
 * tax is withheld from the gross, so the gross is all the cash the payout takes.
 */
function interimCash(forecast: YearForecast, rows: readonly Transaction[], lastComplete: MonthKey, gross: Money): InterimCash {
  const dueBy = lastDayOf(monthOf(forecast.asOf))
  const taxDue = forecast.cit.history.filter((entry) => entry.outstanding > 0 && entry.obligation.dueOn <= dueBy).map(outstandingFigure)
  const payDue = forecast.categories
    .filter((entry) => entry.category.roles.includes(PACK_ROLES.arrears))
    .map((entry) => monthOfLine(entry.forecast, lastComplete))
    .filter((month) => !month.bases.includes('actual'))
    .map((month) => deducted(month.figure))
  const cash = cashOnNewestBooking(rows)
  const fallingDue = { ...summed('What falls due by', [...taxDue, ...payDue], 'ledger'), on: dueBy }
  const available = summed('Cash for an interim payout now', [cash, deducted(fallingDue)], 'ledger')
  const allowed = available.amount < gross ? available.amount : gross
  const largestPayout = tracedFigure('The largest interim payout the cash covers, its tax included', allowed > 0 ? allowed : ZERO, 'ledger', available.rules, [available])
  return { cash, fallingDue, available, largestPayout }
}

/**
 * Retained earnings and reserves the year starts with: nothing in a first period, the year-end
 * tab's figures when it holds the year before, or else the year before's own opening, less what it
 * paid out, plus its forecast profit after tax.
 */
function openingEquity(year: number, forecast: YearForecast, workbook: Workbook, rules: RuleSource): { readonly reserves: TracedFigure; readonly retained: TracedFigure } {
  if (forecast.period.first) {
    return { reserves: tracedFigure('No reserves in a first period', ZERO, 'ledger', []), retained: tracedFigure('Nothing retained in a first period', ZERO, 'ledger', []) }
  }
  const fromTab = equityBroughtForward(workbook.yearEndLines, year)
  if (fromTab !== null) {
    return fromTab
  }
  const prior = forecastYear(workbook, year - 1, forecast.asOf, rules)
  const before = openingEquity(year - 1, prior, workbook, rules)
  const steps = [before.retained, deducted(paidOutIn(year - 1, workbook.transactions.filter((row) => row.date <= forecast.asOf), workbook)), prior.profitAfterTax]
  return {
    reserves: before.reserves,
    retained: tracedFigure(`Retained at the start of ${year}, with the forecast profit of ${year - 1}`, sumMoney(steps.map((step) => step.amount)), 'ledger', rulesOf(steps), steps),
  }
}

/** Profit paid out in the year and the tax on it, read positive. */
function paidOutIn(year: number, rows: readonly Transaction[], workbook: Workbook): TracedFigure {
  const slugs = categoriesWithRole(workbook.categories, PACK_ROLES.profitDistribution)
  const paid = rows.filter((row) => slugs.includes(row.category) && yearOf(row.date) === year)
  return withDrill(
    tracedFigure(`Profit paid out in ${year}, with its tax`, negateMoney(sumMoney(paid.map((row) => row.amount))), 'ledger', []),
    drillToTransactions({ period: { preset: 'year', year }, categories: slugs }),
  )
}

/** The share capital from the latest year-end tab before the year, else the statutory minimum. */
function shareCapitalOf(workbook: Workbook, year: number, rules: RuleSource): TracedFigure {
  const lines = workbook.yearEndLines.filter((line) => line.year < year && line.statement === 'balance' && line.line === 'share-capital')
  const latest = lines.reduce<(typeof lines)[number] | null>((found, line) => (found === null || line.year > found.year ? line : found), null)
  if (latest !== null && latest.figure.kind === 'money') {
    return tracedFigure(`Share capital at the end of ${latest.year}`, latest.figure.amount, 'accountant', [])
  }
  const minimum = rules('hr.ztd.min-share-capital', civilDate(year, 12, 31))
  return tracedFigure('The minimum share capital, as no year-end line gives the company’s', minimum.value.minimumShareCapital.cents, 'ledger', [minimum.citation])
}

/** What the grants' clawback terms put at risk on a day, each grant with the last day its amount applies. */
function clawbackOn(workbook: Workbook, on: CivilDate): TracedFigure {
  const steps = workbook.grants.flatMap((grant) => {
    const exposure = clawbackExposure(grant, on)
    if (exposure === null) {
      return []
    }
    const named = { ...exposure.amount, label: `${grant.slug}: ${exposure.amount.label}` }
    return [exposure.until === null ? named : { ...named, label: `${named.label}, until`, on: exposure.until }]
  })
  return { ...summed('At risk from the grant clawback terms on', steps, 'assets'), on }
}
