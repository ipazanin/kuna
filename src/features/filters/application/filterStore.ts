import { readonly, shallowRef } from 'vue'
import type { DeepReadonly, Ref } from 'vue'
import { useRouter } from 'vue-router'
import type { RouteLocationNormalizedLoaded, RouteLocationRaw, Router } from 'vue-router'

import { applyDrill } from '../domain/drillTarget'
import type { DrillRoute, DrillTarget } from '../domain/drillTarget'
import { decodeFilters, encodeFilters, hasFilterKeys, withoutFilterKeys } from '../domain/filterQuery'
import { DEFAULT_FILTERS } from '../domain/filterState'
import type { FilterState } from '../domain/filterState'

/** The page each drill opens, with the tab it opens on when that is not the page's default tab. */
const ROUTE_PATHS: Readonly<Record<DrillRoute, { readonly path: string; readonly tab?: string }>> = {
  overview: { path: '/' },
  transactions: { path: '/transactions' },
  breakdown: { path: '/analysis' },
  'over-time': { path: '/analysis', tab: 'over-time' },
  compare: { path: '/analysis', tab: 'compare' },
}

// One filter state for the whole app, mirrored into the route query so every view is linkable.
const filters = shallowRef<FilterState>(DEFAULT_FILTERS)
let boundRouter: Router | null = null
let unbind: (() => void) | null = null

export interface FilterStore {
  readonly filters: DeepReadonly<Ref<FilterState>>
  setFilters(next: FilterState): Promise<void>
  /** Where a figure's drill leads, for a link. Null when no row is behind the figure. */
  drillLocation(drill: DrillTarget): RouteLocationRaw | null
}

/**
 * Keeps the filter state and the route query in step. A query with filter keys sets the state. A
 * navigation without any, such as a plain nav link, keeps the state and writes it back into the
 * query, so the filters survive moving between screens. Returns the function that undoes it.
 */
export function bindFiltersToRouter(router: Router): () => void {
  unbind?.()
  boundRouter = router
  const follow = (route: RouteLocationNormalizedLoaded): void => {
    if (hasFilterKeys(route.query)) {
      filters.value = decodeFilters(route.query)
      return
    }
    const encoded = encodeFilters(filters.value)
    if (Object.keys(encoded).length > 0) {
      void router.replace({ query: { ...route.query, ...encoded }, hash: route.hash })
    }
  }
  follow(router.currentRoute.value)
  const stop = router.afterEach((to) => follow(to))
  unbind = () => {
    stop()
    boundRouter = null
    unbind = null
  }
  return unbind
}

/** The shared filter state. The first call from a component binds it to that app's router. */
export function useFilters(): FilterStore {
  if (boundRouter === null) {
    bindFiltersToRouter(useRouter())
  }
  return {
    filters: readonly(filters),
    setFilters,
    drillLocation,
  }
}

async function setFilters(next: FilterState): Promise<void> {
  filters.value = next
  const router = requireRouter()
  await router.replace({ query: queryFor(router, next) })
}

/**
 * The drill's screen with the narrowed filters in its query. The period is always written out, so
 * following the link sets the filters even where they come out at their defaults. The drill opens
 * on the tab its route names, so the tab of the page it starts from never carries over.
 */
function drillLocation(drill: DrillTarget): RouteLocationRaw | null {
  const narrowed = applyDrill(filters.value, drill.filters)
  if (narrowed === null) {
    return null
  }
  const target = ROUTE_PATHS[drill.route]
  const { tab: _sourceTab, ...query } = queryFor(requireRouter(), narrowed, { explicitPeriod: true })
  return { path: target.path, query: target.tab === undefined ? query : { ...query, tab: target.tab } }
}

function queryFor(router: Router, state: FilterState, options: { explicitPeriod?: boolean } = {}): Record<string, string | string[]> {
  const kept = withoutFilterKeys(router.currentRoute.value.query)
  const others = Object.fromEntries(
    Object.entries(kept).flatMap(([key, value]) => (typeof value === 'string' ? [[key, value]] : [])),
  )
  return { ...others, ...encodeFilters(state, options) }
}

function requireRouter(): Router {
  if (boundRouter === null) {
    throw new Error('The filters are not bound to a router. Call useFilters() from a component first.')
  }
  return boundRouter
}
