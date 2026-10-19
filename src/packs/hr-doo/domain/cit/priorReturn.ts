import type { YearEndLine } from '../../../../features/workbook/domain/yearEnd'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { monthCountBetween, monthOf } from '../../../../shared/calendar/monthKey'
import { ruleValue } from '../../ruleset/ruleset'
import { tracedFigure } from '../payroll/payrollArithmetic'
import type { RuleSource } from '../payroll/payrollArithmetic'
import { monthlyAdvanceOf, taxPeriodOf } from './citLiability'
import type { CitLiability } from './citLiability'

/** What a later year's schedule reads of a year's PD return. Our own `CitLiability` is one. */
export type PriorReturn = Pick<CitLiability, 'period' | 'liability' | 'balanceDue' | 'monthlyAdvance'>

/**
 * The return of a closed year from the accountant's lines on the year-end tab, or null when the
 * tab has no liability for the year. The monthly advance is the tab's PD line 59. Without it, the
 * liability is divided by the tab's months of operation, or by the months the period touches.
 */
export function closedYearReturn(
  lines: readonly YearEndLine[],
  year: number,
  registered: CivilDate | null,
  rules: RuleSource = ruleValue,
): PriorReturn | null {
  const taxLine = (line: string) => lines.find((candidate) => candidate.year === year && candidate.statement === 'tax' && candidate.line === line)?.figure
  const liabilityLine = taxLine('liability')
  if (liabilityLine?.kind !== 'money') {
    return null
  }
  const period = taxPeriodOf(year, registered)
  const liability = tracedFigure(`PD line 53 for ${year}, as the accountant filed it`, liabilityLine.amount, 'accountant', [])
  const monthsLine = taxLine('months-of-operation')
  const months = monthsLine?.kind === 'count' ? monthsLine.count : monthCountBetween(monthOf(period.from), monthOf(period.to))
  const balanceLine = taxLine('balance-due')
  const advanceLine = taxLine('monthly-advance')
  return {
    period,
    liability,
    balanceDue: balanceLine?.kind === 'money' ? tracedFigure(`PD line 57 for ${year}, as the accountant filed it`, balanceLine.amount, 'accountant', []) : null,
    monthlyAdvance:
      advanceLine?.kind === 'money'
        ? tracedFigure(`PD line 59 for ${year}, as the accountant filed it`, advanceLine.amount, 'accountant', [])
        : monthlyAdvanceOf(liability, months, year, rules),
  }
}
