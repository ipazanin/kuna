import type { ChangeLine } from './ChangeListCard.vue'
import type { words } from './words'
import { NO_COSTS } from '../../scenarios/domain/loanScenario'
import type { LoanChange } from '../../scenarios/domain/loanScenario'
import { scenarioOutcome } from '../../scenarios/domain/scenarioOutcome'
import { asItStands } from '../../scenarios/domain/scenarioPlan'
import { payoffMonthsLater, refusalText, spanOf, spanText } from '../../scenarios/presentation/scenarioComparison'
import { interestAgainst, scenarioKey, triedSummary, workedScenario } from '../../scenarios/presentation/scenariosView'
import type { BankLoanBook, ScenarioBook } from '../../workbook/domain/readLoanBook'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { formatMoney, formatRate } from '../../../../shared/money/moneyFormat'
import { fractionOf } from '../domain/yearlyRate'

/** A saved try as its list shows it, with the scenario it deletes. */
export interface SavedTry extends ChangeLine {
  readonly kept: ScenarioBook
}

/** A change What if tries: an extra payment, a new rate or a new term. */
export type TriedChange = Extract<LoanChange, { readonly kind: 'extra-payment' | 'rate-change' | 'term-change' }>

/** What a try is called when What if saves it, and wherever a saved term change shows. */
export function tryName(change: TriedChange, loanWords: typeof words): string {
  switch (change.kind) {
    case 'extra-payment':
      return loanWords.whatIf.extraName(formatMoney(change.amount), dayLabel(change.date), loanWords.extraDialog.effects[change.effect].label.toLowerCase())
    case 'rate-change':
      return loanWords.whatIf.rateName(formatRate(fractionOf(change.rate)), dayLabel(change.from))
    case 'term-change':
      return loanWords.whatIf.termName(spanOf(change.instalments), dayLabel(change.from))
  }
}

/**
 * Each try saved for the loan, worked out from today against the loan as it stands: what it changes,
 * then the interest it saves and how much sooner the loan is paid off, or why Kuna cannot work it out.
 * A try of one term change takes its name from the change, whatever name the file keeps.
 */
export function savedTries(book: BankLoanBook, scenarios: readonly ScenarioBook[], today: CivilDate, loanWords: typeof words): SavedTry[] {
  const plan = asItStands(book)
  const stands = plan === null ? null : scenarioOutcome(plan, today)
  return scenarios
    .filter(({ scenario }) => scenario.start.kind === 'loan' && scenario.start.loan === book.loan.id)
    .map((kept) => {
      const worked = workedScenario(scenarioKey(kept.scenario), kept.scenario.name, kept, { ...book, costs: NO_COSTS }, kept.changes, today)
      const summary = triedSummary(worked, loanWords.extraDialog.effects)
      const outcome = worked.outcome
      const months = stands === null || outcome === null ? null : payoffMonthsLater(stands.payoff, outcome.payoff)
      const effect =
        'refused' in worked.plan
          ? refusalText(worked.plan)
          : stands === null || outcome === null
            ? null
            : [interestAgainst(outcome.interest, stands.interest), ...(months === null || months === 0 ? [] : [spanText(months)])].join(', ')
      const [only] = kept.changes
      const title = kept.changes.length === 1 && only?.kind === 'term-change' ? tryName(only, loanWords) : kept.scenario.name
      return { key: worked.key, title, detail: effect === null ? summary : `${summary} ${effect}`, kept }
    })
}
