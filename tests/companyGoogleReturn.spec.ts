// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { Router } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { companyApp } from '../src/apps/company/app'
import { useWorkbook } from '../src/apps/company/workbook/application/workbookStore'
import { seedFakeWorkbook } from '../src/apps/company/workbook/infrastructure/fake/seedFakeWorkbook'
import type { RedirectReturn } from '../src/shared/google/googleRedirect'
import { saveWorkbookChoice } from '../src/shared/storage/infrastructure/workbookChoice'

const toasts: { readonly title: string }[] = []

// The specs run without the Vue compiler or Nuxt UI's app, which the sync group's export control and the toasts need.
vi.mock('../src/apps/company/workbook-files/presentation/LocalWorkbookStatus.vue', () => ({ default: {} }))
vi.mock('@nuxt/ui/composables/useToast', () => ({ useToast: () => ({ add: (toast: { readonly title: string }) => toasts.push(toast) }) }))

/** Google's answer to the onboarding find step's tap, whose trip left the page to find the company's books. */
const FIND_ANSWER: RedirectReturn = {
  kind: 'granted',
  token: { value: 'fake-token', scopes: ['drive.file'], expiresAt: Date.now() + 3_600_000 },
  asked: ['drive.file'],
  resume: 'find',
  app: 'company',
  route: '#/company/start?path=open&step=find',
  ask: 'tap',
}

/** A router of the company's screens that the page came back to at `path`. */
async function routerAt(path: string): Promise<Router> {
  const screen = { render: () => null }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/company', component: screen },
      { path: '/company/start', component: screen },
      { path: '/company/transactions', component: screen },
    ],
  })
  await router.push(path)
  return router
}

beforeEach(async () => {
  toasts.length = 0
  vi.stubEnv('VITE_FAKE_WORKBOOK', 'true')
  // Another device made the books on the fake Drive, and this page has not chosen them.
  await seedFakeWorkbook(null, () => null)
  saveWorkbookChoice('company', null)
})

describe("a find of the company's books that a trip to Google resumes", () => {
  it('opens the books another device made, found by their mark, and ends onboarding on Overview', async () => {
    const router = await routerAt('/company/start?path=open&step=find')

    companyApp.start(router, FIND_ANSWER)

    await vi.waitFor(() => expect(useWorkbook().state.choice).toMatchObject({ source: 'drive', name: 'kuna-company.json' }))
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/company'))
    expect(toasts.map((toast) => toast.title)).toEqual(['Opened kuna-company.json'])
  })

  it('leaves a page that is no longer on onboarding where it is', async () => {
    const router = await routerAt('/company/transactions')

    companyApp.start(router, FIND_ANSWER)

    await vi.waitFor(() => expect(toasts).toHaveLength(1))
    expect(router.currentRoute.value.path).toBe('/company/transactions')
  })
})
