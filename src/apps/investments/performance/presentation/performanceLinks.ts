import type { PerformancePeriod } from '../domain/performancePeriod'

export const PERFORMANCE_ROUTE = '/investments/performance'

/** A period as `?period=` names it: `1y`, `3y`, `5y`, `all` or a year such as `2025`. */
export function periodKey(period: PerformancePeriod): string {
  switch (period.kind) {
    case 'years':
      return `${period.years}y`
    case 'all':
      return 'all'
    case 'year':
      return String(period.year)
  }
}

/** The offered period that `?period=` names, or everything when it names none of them. */
export function periodNamed(offered: readonly PerformancePeriod[], key: unknown): PerformancePeriod {
  return offered.find((period) => periodKey(period) === key) ?? { kind: 'all' }
}
