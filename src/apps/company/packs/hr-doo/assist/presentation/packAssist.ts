import type { AssistTaskSummary } from '../../../../../../shared/app/appContribution'
import { EXPLAIN_FIGURE } from '../application/explainFigure'
import { words } from './words'

/** What explaining a figure sends, for the Assistant card and the first-use dialog. */
export const EXPLAIN_FIGURE_SUMMARY: AssistTaskSummary = {
  id: EXPLAIN_FIGURE,
  title: words.explain.title,
  sends: words.explain.sends,
  employees: { label: words.explain.employees, warning: words.explain.employeesWarning },
}
