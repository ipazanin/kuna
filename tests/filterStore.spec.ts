import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { Router } from 'vue-router'

import { bindFiltersToRouter, useFilters } from '../src/apps/company/filters/application/filterStore'
import { DEFAULT_FILTERS } from '../src/apps/company/filters/domain/filterState'

const SCREEN = { render: () => null }

let router: Router
let unbind: () => void

async function routerAt(location: string): Promise<Router> {
  const created = createRouter({
    history: createMemoryHistory(),
    routes: ['/company', '/company/transactions', '/company/analysis', '/company/invoicing', '/company/owner', '/company/start', '/settings'].map((path) => ({ path, component: SCREEN })),
  })
  await created.push(location)
  await created.isReady()
  return created
}

beforeEach(async () => {
  router = await routerAt('/company')
  unbind = bindFiltersToRouter(router)
  await useFilters().setFilters(DEFAULT_FILTERS)
})

afterEach(() => {
  unbind()
})

describe('filter store', () => {
  it('takes its state from a shared link', async () => {
    unbind()
    router = await routerAt('/company/analysis?p=l3&acc=erste&b=operating')
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

    await router.push('/company/owner')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(router.currentRoute.value.fullPath).toBe('/company/owner?acc=erste')
    expect(useFilters().filters.value.accounts).toEqual(['erste'])
  })

  it('keeps the filters out of the address of Settings and onboarding, and back on the next company screen', async () => {
    await useFilters().setFilters({ ...DEFAULT_FILTERS, accounts: ['erste'] })

    await router.push('/settings?tab=device')
    await router.push('/company/start?step=home')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(router.currentRoute.value.fullPath).toBe('/company/start?step=home')

    await router.push('/company/invoicing')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(router.currentRoute.value.fullPath).toBe('/company/invoicing?acc=erste')
  })

  it('opens a drill on its screen with the filters narrowed', async () => {
    await useFilters().setFilters({ ...DEFAULT_FILTERS, accounts: ['erste'] })

    await router.push(useFilters().drillLocation({ filters: { period: { preset: 'l3' }, buckets: ['taxes'] } })!)

    expect(router.currentRoute.value.path).toBe('/company/transactions')
    expect(router.currentRoute.value.query).toEqual({ p: 'l3', acc: 'erste', b: 'taxes' })
  })

  it('opens a drill on Transactions without the tab of the page it starts from', async () => {
    await router.push('/company/invoicing?tab=plan&year=2026')
    await useFilters().setFilters(DEFAULT_FILTERS)

    expect(useFilters().drillLocation({ filters: { buckets: ['taxes'] } })).toEqual({
      path: '/company/transactions',
      query: { year: '2026', p: 'l12', b: 'taxes' },
    })
  })

  it('writes the period into a drill link, so following it sets the filters even at their defaults', async () => {
    await useFilters().setFilters({ ...DEFAULT_FILTERS, period: { preset: 'l3' } })

    expect(useFilters().drillLocation({ filters: { period: { preset: 'l12' } } })).toEqual({
      path: '/company/transactions',
      query: { p: 'l12' },
    })
  })

  it('stays put when no row is behind the figure', async () => {
    await useFilters().setFilters({ ...DEFAULT_FILTERS, buckets: ['income'] })

    expect(useFilters().drillLocation({ filters: { buckets: ['taxes'] } })).toBeNull()
  })
})
