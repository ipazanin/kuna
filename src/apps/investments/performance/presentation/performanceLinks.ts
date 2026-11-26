import type { PerformancePeriod } from '../domain/performancePeriod'

export const PERFORMANCE_ROUTE = '/investments/performance'

/** A period as `?period=` names it: `1y`, `3y`, `5y`, `all`, a year such as `2025` or a quarter such as `2025q3`. */
export function periodKey(period: PerformancePeriod): string {
  switch (period.kind) {
    case 'years':
      return `${period.years}y`
    case 'all':
      return 'all'
    case 'year':
      return String(period.year)
    case 'quarter':
      return `${period.year}q${period.quarter}`
  }
}

const KEY_PATTERN = /^(?:([135])y|(\d{4})(?:q([1-4]))?)$/

/** The period `?period=` writes, offered or not, or null for a key `periodKey` never writes. */
export function periodOfKey(key: string): PerformancePeriod | null {
  if (key === 'all') return { kind: 'all' }
  const [, years, year, quarter] = KEY_PATTERN.exec(key) ?? []
  if (years !== undefined) return { kind: 'years', years: Number(years) as 1 | 3 | 5 }
  if (year === undefined) return null
  return quarter === undefined ? { kind: 'year', year: Number(year) } : { kind: 'quarter', year: Number(year), quarter: Number(quarter) as 1 | 2 | 3 | 4 }
}

/** The offered period that `?period=` names, or everything when it names none of them. */
export function periodNamed(offered: readonly PerformancePeriod[], key: unknown): PerformancePeriod {
  return offered.find((period) => periodKey(period) === key) ?? { kind: 'all' }
}
