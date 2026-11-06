import type { AssistTaskSummary } from '../../../../../../shared/app/appContribution'
import { EXPLAIN_FIGURE } from '../application/explainFigure'
import { words } from './words'

/** What explaining a figure sends, for the Assistant tab and the dialog that asks first. */
export const EXPLAIN_FIGURE_SUMMARY: AssistTaskSummary = {
  id: EXPLAIN_FIGURE,
  title: words.explain.title,
  sends: words.explain.sends,
  employees: { label: words.explain.employees, note: words.explain.employeesNote, goes: words.explain.employeesGo },
}
