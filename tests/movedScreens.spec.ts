// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest'
import type { Router } from 'vue-router'

import { COMPANY_MOVED_SCREENS } from '../src/apps/company/movedScreens'
import type { AppContribution } from '../src/shared/app/appContribution'
import { installApp } from '../src/shell/routing/appRegistry'
import { createAppRouter } from '../src/shell/routing/router'

const BLANK = () => Promise.resolve({ render: () => null })

/** The company app as the router reads it: the two screens the old Review address now opens, and its moved addresses. */
const company = {
  id: 'company',
  name: 'Company',
  install: () => Promise.resolve(),
  screens: [
    { path: '/company/transactions', title: 'Transactions', icon: 'i-lucide-list', component: BLANK },
    { path: '/company/settings', title: 'Settings', icon: 'i-lucide-settings', component: BLANK },
  ],
  moved: COMPANY_MOVED_SCREENS,
  startPath: '/company/start',
} as unknown as AppContribution

let router: Router

beforeAll(async () => {
  // jsdom has no scrolling, and a new screen opens at its top.
  window.scrollTo = () => undefined
  await installApp(company)
  router = createAppRouter()
})

async function landingOf(address: string) {
  await router.push(address)
  const { path, query } = router.currentRoute.value
  return { path, query }
}

describe('an old link to the Review screen', () => {
  it('opens the To review tab of Transactions with the filters it came with', async () => {
    expect(await landingOf('/company/review')).toEqual({ path: '/company/transactions', query: { tab: 'review' } })
    expect(await landingOf('/company/review?p=all&acc=main')).toEqual({ path: '/company/transactions', query: { p: 'all', acc: 'main', tab: 'review' } })
  })

  it('opens the Category rules tab of Settings from its Rules tab, with the rule it marked', async () => {
    expect(await landingOf('/company/review?tab=rules')).toEqual({ path: '/company/settings', query: { tab: 'category-rules' } })
    expect(await landingOf('/company/review?tab=rules&rule=merchant-airline&p=all')).toEqual({ path: '/company/settings', query: { tab: 'category-rules', rule: 'merchant-airline' } })
  })
})
