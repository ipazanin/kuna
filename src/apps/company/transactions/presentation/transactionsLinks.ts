import type { RouteLocationRaw } from 'vue-router'

import type { Label } from '../../../../shared/categorising/domain/labels'
import { encodeFilters } from '../../filters/domain/filterQuery'
import { DEFAULT_FILTERS } from '../../filters/domain/filterState'

/** The To review tab's value in `?tab=`. */
export const REVIEW_TAB = 'review'

/** The rows that wait for a person, on the To review tab of Transactions. A string, since a sync step's link takes one. */
export const REVIEW_LINK = `/company/transactions?tab=${REVIEW_TAB}`

/** Every row of every month that carries the label, since a label spans any months and Company opens on the last twelve. */
export function labelLink(label: Pick<Label, 'id'>): RouteLocationRaw {
  return { path: '/company/transactions', query: encodeFilters({ ...DEFAULT_FILTERS, period: { preset: 'all' }, labels: [label.id] }, { explicitPeriod: true }) }
}
