import type { RouteLocationRaw } from 'vue-router'

import { yearOfMonth } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'

/** The clients editor on the Clients tab of Invoicing. */
export const CLIENTS_LINK: RouteLocationRaw = { path: '/company/invoicing', query: { tab: 'clients' } }

/** The billing and invoice terms below the clients, opened. */
export const TERMS_LINK: RouteLocationRaw = { path: '/company/invoicing', query: { tab: 'clients' }, hash: '#invoicing-terms' }

/** One month of the Plan tab's month by month list, opened and scrolled to. */
export function planMonthLink(month: MonthKey): RouteLocationRaw {
  return { path: '/company/invoicing', query: { tab: 'plan', year: String(yearOfMonth(month)), month }, hash: `#billing-month-${month}` }
}
