import { dayLabel } from '../../../../../../shared/calendar/dayLabel'
import type { DirectorBasis, ScenarioComponent } from '../../domain/scenarios/ownerPayScenarios'
import { civilDate } from '../../../../../../shared/calendar/civilDate'
import { monthOf } from '../../../../../../shared/calendar/monthKey'
import { monthLabel } from '../../../../../../shared/calendar/monthLabel'
import type { Money } from '../../../../../../shared/money/money'
import { formatMoney } from '../../../../../../shared/money/moneyFormat'
import { ruleValue } from '../../ruleset/ruleset'
import { itemWords } from './payScenariosView'
import { words } from './words'

export const BASIS_WORDS: Readonly<Record<DirectorBasis, string>> = words.bases

/** What a component does, in a phrase. */
export function componentText(component: ScenarioComponent): string {
  switch (component.component) {
    case 'salary_gross':
      return component.gross === 'floor' ? words.components.salaryAtFloor : words.components.salary(formatMoney(component.gross))
    case 'nontaxable':
      return words.components.taxFree(itemWords(component.item), formatMoney(component.amount))
    case 'rent_monthly':
      return words.components.rent(formatMoney(component.amount))
    case 'dividend':
      return component.amount === 'max' ? words.components.dividendMax : words.components.dividend(formatMoney(component.amount))
    case 'director_basis':
      return words.components.insuredAs(BASIS_WORDS[component.basis])
  }
}

/** The days a component holds, in words. A tax-free item and a dividend are paid once. */
export function spanText(component: ScenarioComponent): string {
  if (component.component === 'dividend') {
    return words.components.paidOnce
  }
  if (component.component === 'nontaxable') {
    return component.from === null ? words.components.withJanuary : words.components.withSalaryOf(monthLabel(monthOf(component.from)))
  }
  if (component.from === null && component.to === null) return words.components.allYear
  if (component.from === null) return words.components.until(dayLabel(component.to!))
  if (component.to === null) return words.components.from(dayLabel(component.from))
  return words.components.span(dayLabel(component.from), dayLabel(component.to))
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
