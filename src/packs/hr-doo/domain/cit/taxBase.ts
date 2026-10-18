import type { YearEndLine } from '../../../../features/workbook/domain/yearEnd'
import { civilDate } from '../../../../shared/calendar/civilDate'
import { ZERO, addMoney, moneyFromCents, subtractMoney, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { ruleValue } from '../../ruleset/ruleset'
import type { Rate, RuleCitation } from '../../ruleset/schema'
import type { TracedFigure } from '../../ruleset/tracedFigure'
import { atRate, deducted, percentText, rulesOf, summed, tracedFigure } from '../payroll/payrollArithmetic'
import type { RuleSource } from '../payroll/payrollArithmetic'

/** A tax loss of an earlier year and what is left of it to set against later profits. */
export interface CarriedLoss {
  readonly year: number
  readonly remaining: Money
}

/** The accrual figures of a year the PD return starts from, each with its own build-up. */
export interface TaxBaseInput {
  readonly year: number
  /** PD line 1. */
  readonly revenue: TracedFigure
  /** PD line 2. */
  readonly expenses: TracedFigure
  /** Representation costs with their VAT, which is never deductible. */
  readonly representation: TracedFigure
  readonly personalTransport: TracedFigure
  /** Fines, forced collection and private or non-business costs, which the tax never allows. */
  readonly nonDeductible: TracedFigure
  /** Depreciation charged above what the tax allows, such as a car above the cost cap. */
  readonly depreciationAboveAllowed: TracedFigure
  /** Interest the owner loans would carry at the related-party rate, less what was charged. */
  readonly relatedPartyInterestShortfall: TracedFigure
  /** Tax losses of earlier years still open, oldest first. */
  readonly lossesBroughtForward: readonly CarriedLoss[]
}

/** The PD build-up from accounting profit to the tax base, by form line. */
export interface TaxBase {
  readonly year: number
  readonly revenue: TracedFigure
  readonly expenses: TracedFigure
  /** PD line 3, negative for a loss. */
  readonly profitBeforeTax: TracedFigure
  /** PD line 26. Its steps are the increases by form line. */
  readonly increases: TracedFigure
  /** PD line 35. */
  readonly decreases: TracedFigure
  /** PD line 37. */
  readonly lossesUsed: TracedFigure
  /** PD line 38. Negative when the year ends with a tax loss. */
  readonly base: TracedFigure
  /** What is left to set against later years, oldest first, the year's own loss included. */
  readonly lossesCarried: readonly CarriedLoss[]
}

const BASIS_POINTS_PER_WHOLE = 10_000

/**
 * Accounting profit increased by the costs the corporate tax does not allow and decreased by what
 * it lets the company take off, then less the losses brought forward, oldest first.
 */
export function taxBase(input: TaxBaseInput, rules: RuleSource = ruleValue): TaxBase {
  const period = civilDate(input.year, 1, 1)
  const baseRule = rules('hr.cit.base', period)
  const profitBeforeTax = tracedFigure(
    'PD line 3, profit before tax',
    subtractMoney(input.revenue.amount, input.expenses.amount),
    'ledger',
    [baseRule.citation],
    [input.revenue, deducted(input.expenses)],
  )

  const representation = rules('hr.cit.representation-add-back', period)
  if (!representation.value.includesVat.holds) {
    throw new RangeError(`The representation rule in force in ${input.year} leaves VAT out, which the representation figure includes.`)
  }
  const transport = rules('hr.cit.personal-transport-add-back', period)
  const fines = rules('hr.cit.fines-add-back', period)
  const privateCosts = rules('hr.cit.private-cost-add-back', period)
  const ordinaryIncreases = [
    addBack('PD line 6, representation', input.representation, representation.value.addBackShare.basisPoints, [representation.citation]),
    addBack('PD line 7, personal transport', input.personalTransport, transport.value.addBackShare.basisPoints, [transport.citation]),
    addBack('PD lines 9, 11 and 24, fines, forced collection and private costs', input.nonDeductible, privateCosts.value.addBackShare.basisPoints, [
      fines.citation,
      privateCosts.citation,
    ]),
    tracedFigure(
      'PD line 18, depreciation above the allowed rates and caps',
      input.depreciationAboveAllowed.amount,
      'assets',
      input.depreciationAboveAllowed.rules,
      [input.depreciationAboveAllowed],
    ),
  ]

  const scope = rules('hr.cit.related-party-scope', period)
  const beforeRelatedParty = addMoney(profitBeforeTax.amount, sumMoney(ordinaryIncreases.map((step) => step.amount)))
  const hasLoss = beforeRelatedParty < 0 || input.lossesBroughtForward.some((loss) => loss.remaining > 0)
  const relatedPartyApplies = !scope.value.betweenResidentsRequiresLossOrPreferentialStatus.holds || hasLoss
  const relatedParty = relatedPartyApplies
    ? tracedFigure(
        'PD lines 16 and 25, related-party interest below the prescribed rate',
        input.relatedPartyInterestShortfall.amount,
        'ledger',
        [scope.citation, ...input.relatedPartyInterestShortfall.rules],
        [input.relatedPartyInterestShortfall],
      )
    : tracedFigure('PD lines 16 and 25, no related-party interest: the rule reaches a resident owner only while the company has a tax loss', ZERO, 'ledger', [
        scope.citation,
      ])
  const increases = summed('PD line 26, increases', [...ordinaryIncreases, relatedParty], 'ledger')

  const sponsorship = rules('hr.cit.sponsorship-decrease', period)
  const grantRevenue = rules('hr.cit.grant-revenue', period)
  const decreases = tracedFigure('PD line 35, decreases: none recorded', ZERO, 'ledger', [sponsorship.citation, grantRevenue.citation])

  const beforeLosses = tracedFigure(
    'Tax base before losses brought forward',
    subtractMoney(addMoney(profitBeforeTax.amount, increases.amount), decreases.amount),
    'ledger',
    rulesOf([profitBeforeTax, increases, decreases]),
    [profitBeforeTax, increases, deducted(decreases)],
  )
  const losses = lossRelief(input.year, beforeLosses.amount, input.lossesBroughtForward, rules)
  const base = tracedFigure('PD line 38, tax base', subtractMoney(beforeLosses.amount, losses.used.amount), 'ledger', rulesOf([beforeLosses, losses.used]), [
    beforeLosses,
    deducted(losses.used),
  ])
  const ownLoss: CarriedLoss[] = base.amount < 0 ? [{ year: input.year, remaining: moneyFromCents(0 - base.amount) }] : []
  return {
    year: input.year,
    revenue: input.revenue,
    expenses: input.expenses,
    profitBeforeTax,
    increases,
    decreases,
    lossesUsed: losses.used,
    base,
    lossesCarried: [...losses.left, ...ownLoss],
  }
}

/**
 * The losses still open going into a year, from the PD lines of earlier years on the year-end tab.
 * A negative tax base is that year's loss. A later year sets losses off against its base before
 * losses, which is its revenue less expenses plus increases less decreases.
 */
export function lossesCarriedInto(year: number, yearEnd: readonly YearEndLine[], rules: RuleSource = ruleValue): readonly CarriedLoss[] {
  const moneyOf = (taxYear: number, line: string): Money | null => {
    const found = yearEnd.find((candidate) => candidate.year === taxYear && candidate.statement === 'tax' && candidate.line === line)
    return found?.figure.kind === 'money' ? found.figure.amount : null
  }
  const years = [...new Set(yearEnd.filter((line) => line.statement === 'tax' && line.line === 'tax-base' && line.year < year).map((line) => line.year))].sort(
    (earlier, later) => earlier - later,
  )
  let open: readonly CarriedLoss[] = []
  for (const taxYear of years) {
    const base = moneyOf(taxYear, 'tax-base') ?? ZERO
    const [revenue, expenses, increases, decreases] = ['revenue', 'expenses', 'increases', 'decreases'].map((line) => moneyOf(taxYear, line))
    const beforeLosses =
      revenue === null || expenses === null || increases === null || decreases === null
        ? base
        : subtractMoney(addMoney(subtractMoney(revenue, expenses), increases), decreases)
    const relief = lossRelief(taxYear, beforeLosses, open, rules)
    open = base < 0 ? [...relief.left, { year: taxYear, remaining: moneyFromCents(0 - base) }] : relief.left
  }
  const carryForward = rules('hr.cit.loss-carry-forward', civilDate(year, 1, 1)).value.carryForwardYears.count
  return open.filter((loss) => year - loss.year <= carryForward)
}

/**
 * The part of a cost the tax does not allow. The deductible part is rounded to the cent and the
 * rest is added back, the way the accountant splits representation over two konto lines.
 */
function addBack(label: string, cost: TracedFigure, share: Rate, citations: readonly RuleCitation[]): TracedFigure {
  const deductible = atRate(cost.amount, (BASIS_POINTS_PER_WHOLE - share) as Rate)
  return tracedFigure(`${label}, ${percentText(share)} added back`, subtractMoney(cost.amount, deductible), 'ledger', [...citations, ...cost.rules], [cost])
}

function lossRelief(
  year: number,
  baseBeforeLosses: Money,
  brought: readonly CarriedLoss[],
  rules: RuleSource,
): { readonly used: TracedFigure; readonly left: readonly CarriedLoss[] } {
  const rule = rules('hr.cit.loss-carry-forward', civilDate(year, 1, 1))
  if (rule.value.carryBack.holds) {
    throw new RangeError(`The loss rule in force in ${year} carries losses back, which this build-up does not model.`)
  }
  const usable = (loss: CarriedLoss, inYear: number) => loss.year < inYear && inYear - loss.year <= rule.value.carryForwardYears.count
  const ordered = rule.value.oldestFirst.holds ? [...brought].sort((earlier, later) => earlier.year - later.year) : [...brought]
  let room = baseBeforeLosses > 0 ? baseBeforeLosses : ZERO
  const steps: TracedFigure[] = []
  const left: CarriedLoss[] = []
  for (const loss of ordered) {
    if (!usable(loss, year)) {
      continue
    }
    const applied = Math.min(room, loss.remaining) as Money
    if (applied > 0) {
      steps.push(tracedFigure(`Loss of ${loss.year} set off`, applied, 'accountant', [rule.citation]))
      room = subtractMoney(room, applied)
    }
    const remaining = subtractMoney(loss.remaining, applied)
    if (remaining > 0 && usable(loss, year + 1)) {
      left.push({ year: loss.year, remaining })
    }
  }
  const used = tracedFigure('PD line 37, losses brought forward', sumMoney(steps.map((step) => step.amount)), 'accountant', [rule.citation], steps)
  return { used, left }
}
