import { dayLabel } from '../../../../../../shared/calendar/dayLabel'
import type { DirectorBasis, ScenarioComponent } from '../../domain/scenarios/ownerPayScenarios'
import { civilDate } from '../../../../../../shared/calendar/civilDate'
import { monthOf } from '../../../../../../shared/calendar/monthKey'
import { monthLabel } from '../../../../../../shared/calendar/monthLabel'
import type { Money } from '../../../../../../shared/money/money'
import { formatMoney } from '../../../../../../shared/money/moneyFormat'
import { ruleValue } from '../../ruleset/ruleset'
import { itemWords } from './payScenariosView'

export const BASIS_WORDS: Readonly<Record<DirectorBasis, string>> = {
  employee: 'an employee of the company',
  'board-only': 'a board member only, paying the contributions yourself',
  'insured-elsewhere': 'through a job elsewhere',
}

/** What a component does, in a phrase. */
export function componentText(component: ScenarioComponent): string {
  switch (component.component) {
    case 'salary_gross':
      return component.gross === 'floor' ? 'Salary at the director floor' : `Salary of ${formatMoney(component.gross)} a month`
    case 'nontaxable':
      return `${itemWords(component.item)}, ${formatMoney(component.amount)} tax free`
    case 'rent_monthly':
      return `Rent of ${formatMoney(component.amount)} a month`
    case 'dividend':
      return component.amount === 'max' ? "Dividend of the year's profit after tax, as far as it can be paid out" : `Dividend of ${formatMoney(component.amount)}`
    case 'director_basis':
      return `Insured as ${BASIS_WORDS[component.basis]}`
  }
}

/** The days a component holds, in words. A tax-free item and a dividend are paid once. */
export function spanText(component: ScenarioComponent): string {
  if (component.component === 'dividend') {
    return 'Paid once the year’s statements are adopted'
  }
  if (component.component === 'nontaxable') {
    return component.from === null ? 'Paid with the January salary' : `Paid with the salary of ${monthLabel(monthOf(component.from))}`
  }
  if (component.from === null && component.to === null) return 'All year'
  if (component.from === null) return `Until ${dayLabel(component.to!)}`
  if (component.to === null) return `From ${dayLabel(component.from)}`
  return `${dayLabel(component.from)} to ${dayLabel(component.to)}`
}

export interface YearlyItem {
  readonly item: string
  readonly label: string
  readonly cap: Money
}

/** The tax-free items a scenario can hold in a year: those the ruleset caps by the year. */
export function yearlyItems(year: number): readonly YearlyItem[] {
  const rows = ruleValue('hr.pit.nontaxable-caps', civilDate(year, 1, 1)).value.caps.rows
  return rows.flatMap((row) => (row.period.text === 'year' && row.cap !== undefined ? [{ item: row.payment.text, label: itemWords(row.payment.text), cap: row.cap.cents }] : []))
}
