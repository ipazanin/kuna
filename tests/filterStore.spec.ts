import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { Router } from 'vue-router'

import { bindFiltersToRouter, useFilters } from '../src/features/filters/application/filterStore'
import { DEFAULT_FILTERS } from '../src/features/filters/domain/filterState'

const SCREEN = { render: () => null }

let router: Router
let unbind: () => void

async function routerAt(location: string): Promise<Router> {
  const created = createRouter({
    history: createMemoryHistory(),
    routes: ['/', '/transactions', '/spending', '/cash'].map((path) => ({ path, component: SCREEN })),
  })
  await created.push(location)
  await created.isReady()
  return created
}

beforeEach(async () => {
  router = await routerAt('/')
  unbind = bindFiltersToRouter(router)
  await useFilters().setFilters(DEFAULT_FILTERS)
})

afterEach(() => {
  unbind()
})

describe('filter store', () => {
  it('takes its state from a shared link', async () => {
    unbind()
    router = await routerAt('/spending?p=l3&acc=erste&b=operating')
    unbind = bindFiltersToRouter(router)

    expect(useFilters().filters.value).toMatchObject({ period: { preset: 'l3' }, accounts: ['erste'], buckets: ['operating'] })
  })

  it('writes a change into the query and keeps keys it does not own', async () => {
    await router.replace({ query: { theme: 'dark' } })

    await useFilters().setFilters({ ...DEFAULT_FILTERS, categories: ['travel'] })

    expect(router.currentRoute.value.query).toEqual({ theme: 'dark', cat: 'travel' })
  })

  it('keeps the filters across a plain navigation to another screen', async () => {
    await useFilters().setFilters({ ...DEFAULT_FILTERS, accounts: ['erste'] })

    await router.push('/cash')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(router.currentRoute.value.fullPath).toBe('/cash?acc=erste')
    expect(useFilters().filters.value.accounts).toEqual(['erste'])
  })

  it('opens a drill on its screen with the filters narrowed', async () => {
    await useFilters().setFilters({ ...DEFAULT_FILTERS, accounts: ['erste'] })

    await router.push(useFilters().drillLocation({ route: 'transactions', filters: { period: { preset: 'l3' }, buckets: ['taxes'] } })!)

    expect(router.currentRoute.value.path).toBe('/transactions')
    expect(router.currentRoute.value.query).toEqual({ p: 'l3', acc: 'erste', b: 'taxes' })
  })

  it('writes the period into a drill link, so following it sets the filters even at their defaults', async () => {
    await useFilters().setFilters({ ...DEFAULT_FILTERS, period: { preset: 'l3' } })

    expect(useFilters().drillLocation({ route: 'spending', filters: { period: { preset: 'l12' } } })).toEqual({
      path: '/spending',
      query: { p: 'l12' },
    })
  })

  it('stays put when no row is behind the figure', async () => {
    await useFilters().setFilters({ ...DEFAULT_FILTERS, buckets: ['income'] })

    expect(useFilters().drillLocation({ route: 'transactions', filters: { buckets: ['taxes'] } })).toBeNull()
  })
})
