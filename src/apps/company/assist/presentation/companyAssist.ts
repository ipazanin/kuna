import type { AssistTaskSummary } from '../../../../shared/app/appContribution'
import { SUGGEST_CATEGORIES } from '../application/suggestCategories'
import { words } from './words'

/** What suggesting categories sends, for the Assistant card and the first-use dialog. */
export const SUGGEST_CATEGORIES_SUMMARY: AssistTaskSummary = {
  id: SUGGEST_CATEGORIES,
  title: words.suggest.title,
  sends: words.suggest.sends,
  employees: { label: words.suggest.employees, warning: words.suggest.employeesWarning },
}
