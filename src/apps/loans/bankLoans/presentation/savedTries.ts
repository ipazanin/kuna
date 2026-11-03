import type { ChangeLine } from './ChangeListCard.vue'
import type { words } from './words'
import { NO_COSTS } from '../../scenarios/domain/loanScenario'
import { scenarioOutcome } from '../../scenarios/domain/scenarioOutcome'
import { asItStands } from '../../scenarios/domain/scenarioPlan'
import { payoffMonthsLater, refusalText, spanText } from '../../scenarios/presentation/scenarioComparison'
import { interestAgainst, scenarioKey, triedSummary, workedScenario } from '../../scenarios/presentation/scenariosView'
import type { BankLoanBook, ScenarioBook } from '../../workbook/domain/readLoanBook'
import type { CivilDate } from '../../../../shared/calendar/civilDate'

/** A saved try as its list shows it, with the scenario it deletes. */
export interface SavedTry extends ChangeLine {
  readonly kept: ScenarioBook
}

/**
 * Each try saved for the loan, worked out from today against the loan as it stands: what it changes,
 * then the interest it saves and how much sooner the loan is paid off, or why Kuna cannot work it out.
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
      return { key: worked.key, title: kept.scenario.name, detail: effect === null ? summary : `${summary} ${effect}`, kept }
    })
}
