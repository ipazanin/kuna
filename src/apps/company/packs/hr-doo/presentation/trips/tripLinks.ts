import type { RouteLocationRaw } from 'vue-router'

import type { RecordId } from '../../../../../../shared/storage/domain/recordId'
import { keyOfRecordId } from '../../../../../../shared/storage/domain/recordId'
import { TRIP_RECORDS } from '../../domain/hrDooKinds'

export const TRIPS_ROUTE = '/company/trips'

/** The query key that opens one travel order on the Trips screen, by the trip's bare id. */
export const TRIP_QUERY = 'trip'

/** The tab of a trip's page that holds its settlement. Its order is the first tab, which stays out of the address. */
export const SETTLEMENT_TAB = 'settlement'

/** A travel order's page on the Trips screen, on its order or on its settlement. */
export function tripLink(trip: RecordId, tab: 'order' | typeof SETTLEMENT_TAB = 'order'): RouteLocationRaw {
  const key = keyOfRecordId(TRIP_RECORDS, trip)
  return { path: TRIPS_ROUTE, query: tab === 'order' ? { [TRIP_QUERY]: key } : { [TRIP_QUERY]: key, tab } }
}
