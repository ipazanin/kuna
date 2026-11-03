import type { RouteLocationRaw } from 'vue-router'

import { yearDueNext } from '../domain/taxDeadlines'
import type { CivilDate } from '../../../../shared/calendar/civilDate'

export const TAX_ROUTE = '/investments/tax'

/** The tabs as `?tab=` names them. The first is the default and stays out of the address. */
export const TAX_TABS = ['year', 'sales', 'foreign', 'tax-free'] as const

export type TaxTab = (typeof TAX_TABS)[number]

/** The offered year that `?year=` names, or the year whose JOPPD is due next. */
export function yearNamed(offered: readonly number[], key: unknown, today: CivilDate): number {
  return offered.find((year) => String(year) === key) ?? yearDueNext(today)
}

export function taxLink(year: number, tab: TaxTab): RouteLocationRaw {
  return { path: TAX_ROUTE, query: tab === 'year' ? { year: String(year) } : { year: String(year), tab } }
}
