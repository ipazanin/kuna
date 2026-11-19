// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest'
import type { Router } from 'vue-router'

import { SPENDING_MOVED_SCREENS } from '../src/apps/spending/movedScreens'
import type { AppContribution } from '../src/shared/app/appContribution'
import { installApp } from '../src/shell/routing/appRegistry'
import { createAppRouter } from '../src/shell/routing/router'

const BLANK = () => Promise.resolve({ render: () => null })

/** The spending app as the router reads it: Settings, the Sorting screen its old addresses now open, and its moved addresses. */
const spending = {
  id: 'spending',
  name: 'Spending',
  install: () => Promise.resolve(),
  screens: [
    { path: '/spending/sorting', title: 'Sorting', icon: 'i-lucide-tags', component: BLANK },
    { path: '/spending/settings', title: 'Settings', icon: 'i-lucide-settings', component: BLANK },
  ],
  moved: SPENDING_MOVED_SCREENS,
  startPath: '/spending/start',
} as unknown as AppContribution

let router: Router

beforeAll(async () => {
  // jsdom has no scrolling, and a new screen opens at its top.
  window.scrollTo = () => undefined
  await installApp(spending)
  router = createAppRouter()
})

async function landingOf(address: string) {
  await router.push(address)
  const { path, query, hash } = router.currentRoute.value
  return { path, query, hash }
}

describe("an old link to Spending's labels or rules", () => {
  it('opens the Labels card of Sorting from the old Labels screen, with the query it came with', async () => {
    expect(await landingOf('/spending/labels')).toEqual({ path: '/spending/sorting', query: {}, hash: '#labels' })
    expect(await landingOf('/spending/labels?label=renovation')).toEqual({ path: '/spending/sorting', query: { label: 'renovation' }, hash: '#labels' })
  })

  it("opens the Rules card of Sorting from Settings' old Rules tab, without the tab", async () => {
    expect(await landingOf('/spending/settings?tab=rules')).toEqual({ path: '/spending/sorting', query: {}, hash: '#rules' })
    expect(await landingOf('/spending/settings?tab=rules&category=fuel')).toEqual({ path: '/spending/sorting', query: { category: 'fuel' }, hash: '#rules' })
  })

  it("leaves Settings' other tabs where they are", async () => {
    expect(await landingOf('/spending/settings?tab=bank-sync')).toEqual({ path: '/spending/settings', query: { tab: 'bank-sync' }, hash: '' })
    expect(await landingOf('/spending/settings')).toEqual({ path: '/spending/settings', query: {}, hash: '' })
  })
})
