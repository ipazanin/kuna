import { leftOver } from '../domain/leftOver'
import { NO_COSTS, changeDate } from '../domain/loanScenario'
import type { LoanChange, LoanCosts, LoanScenario, OfferTerms } from '../domain/loanScenario'
import { offerEks } from '../domain/effectiveRate'
import { moveBreakEven, scenarioOutcome } from '../domain/scenarioOutcome'
import type { MoveBreakEven, ScenarioOutcome } from '../domain/scenarioOutcome'
import { asItStands, offerBase, scenarioPlan } from '../domain/scenarioPlan'
import type { ScenarioBase, ScenarioPlan, ScenarioRefusal } from '../domain/scenarioPlan'
import { compareScenarios, letterOf, payoffMonthsLater, refusalText, spanOf, spanText } from './scenarioComparison'
import type { ComparedScenario, ScenarioComparison, ScenarioTab as TabKind } from './scenarioComparison'
import type { ChartedScenario } from './scenarioCharts'
import { scenarioMonths } from './scenarioMonths'
import { AS_IT_STANDS, OFFERS_TAB } from './useScenarioCompare'
import type { PickedScenario } from './useScenarioCompare'
import { words } from './words'
import { payoffDate } from '../../bankLoans/domain/loanFigures'
import { fractionOf } from '../../bankLoans/domain/yearlyRate'
import type { YearlyRate } from '../../bankLoans/domain/yearlyRate'
import { words as bankWords } from '../../bankLoans/presentation/words'
import { scenarioTabOf } from '../../overview/presentation/loanLinks'
import { LOAN_SCENARIO_RECORDS } from '../../workbook/domain/loanKinds'
import type { RatePeriod } from '../../workbook/domain/ratePeriod'
import type { BankLoanBook, LoanBook, ScenarioBook } from '../../workbook/domain/readLoanBook'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { monthLabel } from '../../../../shared/calendar/monthLabel'
import { lastDayOf, monthOf } from '../../../../shared/calendar/monthKey'
import { moneyFromAmount, subtractMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { formatMoney, formatRate } from '../../../../shared/money/moneyFormat'
import { keyOfRecordId } from '../../../../shared/storage/domain/recordId'
import { plural } from '../../../../shared/text/translation'
import { withFullStop } from '../../../../shared/text/withFullStop'
import type { Fact } from '../../../../shared/ui/FactGrid.vue'

/** A bank loan's tab: the loan and the scenarios kept for it. */
export interface LoanTab {
  readonly kind: 'loan'
  readonly value: string
  readonly label: string
  readonly book: BankLoanBook
  readonly scenarios: readonly ScenarioBook[]
  /** The day its last instalment fell due, once that is past. */
  readonly paidOff: CivilDate | null
}

/** The Offers tab: the offers you are weighing. */
export interface OffersTab {
  readonly kind: 'offers'
  readonly value: string
  readonly label: string
  readonly scenarios: readonly ScenarioBook[]
}

export type ScenariosTab = LoanTab | OffersTab

/** The extra payment a loan's tab with no scenarios offers to try next month. */
export const TRIED_EXTRA = moneyFromAmount(5000)

/** A scenario's key in the address and on the screen, its bare UUID. */
export function scenarioKey(scenario: LoanScenario): string {
  return keyOfRecordId(LOAN_SCENARIO_RECORDS, scenario.id)
}

/** The letter and colour token a compared scenario wears on every mark. */
export interface ScenarioMarking {
  readonly letter: string
  readonly colour: string
}

/**
 * A tab per bank loan, then Offers. A loan paid off keeps its tab only while it has scenarios,
 * since from today there is nothing left to compare.
 */
export function scenarioTabs(book: LoanBook, today: CivilDate): ScenariosTab[] {
  const loans = book.bankLoans.flatMap((loanBook): LoanTab[] => {
    const scenarios = book.scenarios.filter(({ scenario }) => scenario.start.kind === 'loan' && scenario.start.loan === loanBook.loan.id)
    const last = loanBook.plan === null ? null : payoffDate(loanBook.plan)
    const paidOff = last !== null && last <= today ? last : null
    if (paidOff !== null && scenarios.length === 0) return []
    return [{ kind: 'loan', value: scenarioTabOf(loanBook.loan), label: loanBook.loan.name, book: loanBook, scenarios, paidOff }]
  })
  const offers = book.scenarios.filter(({ scenario }) => scenario.start.kind === 'offer')
  return [...loans, { kind: 'offers', value: OFFERS_TAB, label: words.offers, scenarios: offers }]
}

/** A scenario, or the loan as it stands, worked out for its tab. */
export interface WorkedScenario {
  readonly key: string
  readonly name: string
  /** The kept scenario, or null for the loan as it stands. */
  readonly kept: ScenarioBook | null
  readonly plan: ScenarioPlan | ScenarioRefusal
  /** Null when Kuna cannot work the scenario out. */
  readonly outcome: ScenarioOutcome | null
  /** The month a move's costs are paid back, null without a move or when they never are. */
  readonly breakEven: MoveBreakEven | null
  /** Kuna's estimate of an offer's effective rate. */
  readonly eks: YearlyRate | null
}

/** A scenario's plan and figures, from the day for a loan's scenario, or over the whole loan for an offer with `from` null. */
export function workedScenario(key: string, name: string, kept: ScenarioBook | null, base: ScenarioBase, changes: readonly LoanChange[], from: CivilDate | null): WorkedScenario {
  const plan = scenarioPlan(base, changes, from)
  if ('refused' in plan) return { key, name, kept, plan, outcome: null, breakEven: null, eks: null }
  const withoutMove =
    plan.move === null
      ? null
      : scenarioPlan(
          base,
          changes.filter((change) => change.kind !== 'move'),
          from,
        )
  return {
    key,
    name,
    kept,
    plan,
    outcome: scenarioOutcome(plan, from),
    breakEven: withoutMove === null || 'refused' in withoutMove ? null : moveBreakEven(plan, withoutMove),
    eks: from === null ? offerEks(base, changes) : null,
  }
}

/** The loan as it stands, worked out from the day, or null while its plan cannot be. */
export function standing(book: BankLoanBook, today: CivilDate): WorkedScenario | null {
  const plan = asItStands(book)
  return plan === null ? null : { key: AS_IT_STANDS, name: words.asItStands, kept: null, plan, outcome: scenarioOutcome(plan, today), breakEven: null, eks: null }
}

/** Every scenario of the tab worked out, a loan's tab starting with the loan as it stands. Empty for a loan whose plan cannot be worked out. */
export function workedScenarios(tab: ScenariosTab, today: CivilDate): WorkedScenario[] {
  if (tab.kind === 'offers') {
    return tab.scenarios.flatMap((kept) =>
      kept.scenario.start.kind === 'offer' ? [workedScenario(scenarioKey(kept.scenario), kept.scenario.name, kept, offerBase(kept.scenario.name, kept.scenario.start.terms), kept.changes, null)] : [],
    )
  }
  const stands = standing(tab.book, today)
  if (stands === null) return []
  const base: ScenarioBase = { ...tab.book, costs: NO_COSTS }
  return [stands, ...tab.scenarios.map((kept) => workedScenario(scenarioKey(kept.scenario), kept.scenario.name, kept, base, kept.changes, today))]
}

/** A picked scenario in its slot. */
export interface SlottedScenario {
  readonly worked: WorkedScenario
  readonly slot: number
  readonly letter: string
  /** The colour token of its marks, such as `--scenario-2`. */
  readonly colour: string
}

export function slotted(worked: readonly WorkedScenario[], picked: readonly PickedScenario[]): SlottedScenario[] {
  return picked.flatMap(({ key, slot }) => {
    const found = worked.find((entry) => entry.key === key)
    return found === undefined ? [] : [{ worked: found, slot, letter: letterOf(slot), colour: `--scenario-${slot}` }]
  })
}

/** The compared scenarios side by side, with what each leaves you ahead at the savings rate when one is typed in. Scenarios Kuna cannot work out stay out. */
export function tabComparison(tab: ScenariosTab, compared: readonly SlottedScenario[], base: string, savings: YearlyRate | null): ScenarioComparison {
  const workedOut = compared.flatMap(({ worked, slot }) => (worked.outcome === null || 'refused' in worked.plan ? [] : [{ worked, outcome: worked.outcome, plan: worked.plan, slot }]))
  const basePlan = workedOut.find((entry) => entry.worked.key === base)?.plan ?? null
  const ahead =
    savings === null || basePlan === null
      ? null
      : leftOver(
          workedOut.map((entry) => entry.plan),
          basePlan,
          savings,
        )
  const scenarios = workedOut.map((entry, index): ComparedScenario => ({
    key: entry.worked.key,
    name: entry.worked.name,
    slot: entry.slot,
    outcome: entry.outcome,
    eks: entry.worked.eks,
    bankEks: entry.worked.kept?.scenario.start.kind === 'offer' ? entry.worked.kept.scenario.start.terms.bankEks : null,
    leftOver: ahead?.[index] ?? null,
  }))
  const tabKind: TabKind = tab.kind === 'offers' ? 'offers' : 'loan'
  return compareScenarios(scenarios, base, tabKind, tab.kind === 'loan' ? (tab.book.loan.subsidy?.payer ?? '') : '')
}

/** The earliest payoff among the compared scenarios, by which the left-over line counts. */
export function earliestPayoff(compared: readonly SlottedScenario[]): CivilDate | null {
  return compared.reduce<CivilDate | null>((earliest, { worked }) => {
    const day = worked.outcome?.payoff ?? null
    return day !== null && (earliest === null || day < earliest) ? day : earliest
  }, null)
}

/** "€10,991.19 less", "€800.00 more" or "the same". */
export function moneyAgainst(figure: Money, base: Money): string {
  const difference = subtractMoney(figure, base)
  if (difference === 0) return words.card.same
  return difference < 0 ? words.card.less(formatMoney(-difference)) : words.card.more(formatMoney(difference))
}

/** "2 y 7 m sooner", "4 m later" or "the same". */
export function payoffAgainst(figure: CivilDate | null, base: CivilDate | null): string | null {
  const later = payoffMonthsLater(base, figure)
  return later === null ? null : later === 0 ? words.card.same : spanText(later)
}

/** The three facts of a scenario's card, each with its difference to the base. */
export function cardFacts(outcome: ScenarioOutcome, base: ScenarioOutcome | null, offers: boolean): Fact[] {
  const caption = (text: string | null): Pick<Fact, 'caption'> => (base === null || text === null ? {} : { caption: text })
  return [
    { label: words.card.paidOff, value: outcome.payoff === null ? '–' : monthLabel(monthOf(outcome.payoff)), ...caption(base === null ? null : payoffAgainst(outcome.payoff, base.payoff)) },
    { label: offers ? words.lines.interest : words.lines.interestLeft, value: formatMoney(outcome.interest), ...caption(base === null ? null : moneyAgainst(outcome.interest, base.interest)) },
    { label: words.lines.total, value: formatMoney(outcome.total), ...caption(base === null ? null : moneyAgainst(outcome.total, base.total)) },
  ]
}

function rateWithType(rate: YearlyRate, rateType: RatePeriod['rateType']): string {
  return words.summary.rate(formatRate(fractionOf(rate)), bankWords.changes.rateTypes[rateType])
}

/** "3.10% fixed, then 3.85% variable from Apr 2028, an estimate": the rates from the one in force on `from` on. */
function ratesText(periods: readonly Pick<RatePeriod, 'from' | 'rate' | 'rateType'>[], from: CivilDate | null): string {
  const ordered = [...periods].sort((earlier, later) => earlier.from.localeCompare(later.from))
  const current = from === null ? undefined : ordered.filter((period) => period.from <= from).at(-1)
  const shown = ordered.filter((period) => from === null || period.from > from || period === current)
  const parts = shown.map((period, index) =>
    index === 0 ? rateWithType(period.rate, period.rateType) : words.summary.rateFrom(formatRate(fractionOf(period.rate)), bankWords.changes.rateTypes[period.rateType], dayLabel(period.from)),
  )
  return parts.join(words.summary.then) + (shown.some((period) => period.rateType === 'variable') ? words.summary.estimate : '')
}

function costsText(costs: LoanCosts): string {
  return [
    ...(costs.upfront > 0 ? [words.summary.upfront(formatMoney(costs.upfront))] : []),
    ...(costs.monthly > 0 ? [words.summary.monthly(formatMoney(costs.monthly))] : []),
    ...(costs.yearly > 0 ? [words.summary.yearly(formatMoney(costs.yearly))] : []),
  ].join(', ')
}

/** One change in a sentence, such as "Extra €150.00 every month from 20 Jan 2027, shorter term." A move with costs says when they are paid back once `breakEven` is given. */
export function changeSummary(change: LoanChange, breakEven?: MoveBreakEven | null): string {
  const effect = (value: 'shorter-term' | 'lower-instalment') => bankWords.extraDialog.effects[value].label.toLowerCase()
  switch (change.kind) {
    case 'extra-payment':
      return words.summary.extra(formatMoney(change.amount), dayLabel(change.date), effect(change.effect))
    case 'regular-extra-payment': {
      const every = words.summary.every[change.every]
      return change.until === null
        ? words.summary.regular(formatMoney(change.amount), every, dayLabel(change.from), effect(change.effect))
        : words.summary.regularUntil(formatMoney(change.amount), every, dayLabel(change.from), dayLabel(change.until), effect(change.effect))
    }
    case 'rate-change':
      return words.summary.rateChange(rateWithType(change.rate, change.rateType), dayLabel(change.from))
    case 'move': {
      const costs = costsText(change.costs)
      const paidBack = costs === '' || breakEven === undefined ? '' : breakEven === null ? words.summary.neverPaidBack : words.summary.paidBackBy(dayLabel(lastDayOf(breakEven.month)))
      return `${plural(words.summary.move(change.lender, dayLabel(change.on), rateWithType(change.rate, change.rateType), change.instalments), change.instalments)}${costs === '' ? '' : words.summary.moveCosts(costs)}.${paidBack}`
    }
  }
}

/** An offer's terms and rates in a sentence. */
function offerSummary(terms: OfferTerms, changes: readonly LoanChange[]): string {
  const rates = changes.flatMap((change) => (change.kind === 'rate-change' ? [{ from: change.from, rate: change.rate, rateType: change.rateType }] : []))
  const costs = costsText(terms.costs)
  const parts = [
    plural(words.summary.offer(formatMoney(terms.principal), terms.instalments), terms.instalments),
    ...(rates.length === 0 ? [] : [ratesText(rates, null)]),
    ...(costs === '' ? [] : [words.summary.costs(costs)]),
  ]
  const others = changes.filter((change) => change.kind !== 'rate-change').map((change) => changeSummary(change))
  return [withFullStop(parts.join(', ')), ...others].join(' ')
}

/** What a scenario changes, in a line or two of sentences. */
export function scenarioSummary(worked: WorkedScenario, tab: ScenariosTab, today: CivilDate): string {
  if (worked.kept === null) return tab.kind === 'loan' ? words.summary.stands(ratesText(tab.book.ratePeriods, today)) : ''
  const { scenario, changes } = worked.kept
  if (scenario.start.kind === 'offer') return offerSummary(scenario.start.terms, changes)
  if (changes.length === 0) return words.summary.noChanges
  return [...changes]
    .sort((first, second) => changeDate(first).localeCompare(changeDate(second)))
    .map((change) => changeSummary(change, change.kind === 'move' ? worked.breakEven : null))
    .join(' ')
}

/** A scenario's card: its mark, what it changes, its badges and its facts against the base, or why Kuna cannot work it out. */
export interface ScenarioCardView {
  readonly key: string
  readonly letter: string
  readonly colour: string
  readonly name: string
  readonly summary: string
  readonly isBase: boolean
  readonly subsidyBack: boolean
  readonly datePassed: boolean
  readonly facts: readonly Fact[]
  readonly refusal: string | null
}

export function scenarioCards(tab: ScenariosTab, compared: readonly SlottedScenario[], base: string, today: CivilDate): ScenarioCardView[] {
  const baseOutcome = compared.find((entry) => entry.worked.key === base)?.worked.outcome ?? null
  return compared.map(({ worked, letter, colour }) => {
    const isBase = worked.key === base
    return {
      key: worked.key,
      letter,
      colour,
      name: worked.name,
      summary: scenarioSummary(worked, tab, today),
      isBase,
      subsidyBack: (worked.outcome?.subsidyPayback ?? null) !== null,
      datePassed: !('refused' in worked.plan) && worked.plan.passed.length > 0,
      facts: worked.outcome === null ? [] : cardFacts(worked.outcome, isBase ? null : baseOutcome, tab.kind === 'offers'),
      refusal: 'refused' in worked.plan ? refusalText(worked.plan) : null,
    }
  })
}

/** One bar of Against the base: its share of the longest bar, and what it reads. */
export interface AgainstBar {
  readonly key: string
  readonly letter: string
  readonly colour: string
  /** From 0 to 1, 0 for a scenario no better than the base. */
  readonly share: number
  readonly text: string
}

/** How much less each compared scenario has you pay in all than the base, and how much sooner it is paid off. */
export function againstBase(compared: readonly SlottedScenario[], base: string): { readonly payLess: readonly AgainstBar[]; readonly sooner: readonly AgainstBar[] } {
  const baseOutcome = compared.find((entry) => entry.worked.key === base)?.worked.outcome ?? null
  const others = compared.flatMap((entry) => (entry.worked.key === base || entry.worked.outcome === null ? [] : [{ ...entry, outcome: entry.worked.outcome }]))
  if (baseOutcome === null) return { payLess: [], sooner: [] }
  const saved = others.map((entry) => subtractMoney(baseOutcome.total, entry.outcome.total))
  const sooner = others.map((entry) => -(payoffMonthsLater(baseOutcome.payoff, entry.outcome.payoff) ?? 0))
  const mostSaved = Math.max(0, ...saved)
  const mostSooner = Math.max(0, ...sooner)
  return {
    payLess: others.map((entry, index) => {
      const amount = saved[index] ?? 0
      return {
        key: entry.worked.key,
        letter: entry.letter,
        colour: entry.colour,
        share: amount > 0 ? amount / mostSaved : 0,
        text: amount === 0 ? words.card.same : amount > 0 ? formatMoney(amount) : words.card.more(formatMoney(-amount)),
      }
    }),
    sooner: others.map((entry, index) => {
      const months = sooner[index] ?? 0
      const payoff = entry.outcome.payoff
      return {
        key: entry.worked.key,
        letter: entry.letter,
        colour: entry.colour,
        share: months > 0 ? months / mostSooner : 0,
        text: months > 0 ? spanOf(months) : months < 0 ? spanText(-months) : words.against.sameMonth(payoff === null ? '–' : monthLabel(monthOf(payoff))),
      }
    }),
  }
}

/** The charts' lines, one per compared scenario Kuna can work out. */
export function chartedScenarios(compared: readonly SlottedScenario[], from: CivilDate | null): ChartedScenario[] {
  return compared.flatMap(({ worked, letter, colour }) =>
    worked.outcome === null || 'refused' in worked.plan
      ? []
      : [
          {
            key: worked.key,
            letter,
            name: worked.name,
            colour,
            months: scenarioMonths(worked.plan, from),
            variableFrom: worked.outcome.variableFrom === null ? null : monthOf(worked.outcome.variableFrom),
          },
        ],
  )
}

/** One line of the list of kept scenarios. */
export interface ScenarioRow {
  readonly key: string
  readonly name: string
  /** Its letter and colour while compared, or null. */
  readonly mark: ScenarioMarking | null
  readonly detail: string
  /** The kept scenario, or null for the loan as it stands, which is edited on its own page. */
  readonly kept: ScenarioBook | null
}

/** Every scenario of the tab, compared or not, with its changes and what it does to the interest against the base. */
export function scenarioRows(worked: readonly WorkedScenario[], compared: readonly SlottedScenario[], base: string): ScenarioRow[] {
  const baseOutcome = worked.find((entry) => entry.key === base)?.outcome ?? null
  return worked.map((entry) => {
    const slot = compared.find((held) => held.worked.key === entry.key)
    const mark = slot === undefined ? null : { letter: slot.letter, colour: slot.colour }
    if (entry.kept === null) return { key: entry.key, name: entry.name, mark, detail: words.list.stands, kept: null }
    const { scenario, changes } = entry.kept
    const what =
      scenario.start.kind === 'offer'
        ? plural(words.summary.offer(formatMoney(scenario.start.terms.principal), scenario.start.terms.instalments), scenario.start.terms.instalments)
        : plural(words.list.changes(changes.length), changes.length)
    const effect =
      'refused' in entry.plan ? refusalText(entry.plan) : entry.outcome === null || baseOutcome === null || entry.key === base ? null : interestAgainst(entry.outcome.interest, baseOutcome.interest)
    const detail = [...(mark === null ? [words.list.notCompared] : []), what, ...(effect === null ? [] : [effect])].join(' · ')
    return { key: entry.key, name: entry.name, mark, detail, kept: entry.kept }
  })
}

function interestAgainst(figure: Money, base: Money): string {
  const difference = subtractMoney(figure, base)
  if (difference === 0) return words.list.sameInterest
  return difference < 0 ? words.list.lessInterest(formatMoney(-difference)) : words.list.moreInterest(formatMoney(difference))
}
