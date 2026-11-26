import type { Period } from '../../../../shared/calendar/period'
import type { PeriodPreset } from '../../../../shared/calendar/periodPresets'
import { periodOfText } from '../../../../shared/calendar/periodText'

/** The kinds of period Analysis's breakdown offers. */
export const BREAKDOWN_PRESETS: readonly PeriodPreset[] = ['month', 'quarter', 'year', 'l12', 'custom']

/** The period the breakdown's `?period=` names, or null for text that names none it offers, which opens this month. */
export function breakdownPeriodOf(text: string | null): Period | null {
  const named = periodOfText(text)
  return named !== null && BREAKDOWN_PRESETS.includes(named.preset) ? named : null
}
