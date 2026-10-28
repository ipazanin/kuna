// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import type { Router } from 'vue-router'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { loansApp } from '../src/apps/loans/app'
import { useLoansBooks } from '../src/apps/loans/workbook/application/loansStore'
import { seedFakeLoans } from '../src/apps/loans/workbook/infrastructure/fake/seedFakeLoans'
import { seedFakeWorkbook } from '../src/apps/company/workbook/infrastructure/fake/seedFakeWorkbook'
import { resumedBy } from '../src/shared/google/googleRedirect'
import type { RedirectReturn } from '../src/shared/google/googleRedirect'
import { loadWorkbookChoice } from '../src/shared/storage/infrastructure/workbookChoice'

const toasts: { readonly title: string }[] = []

// The specs run without the Vue compiler or Nuxt UI's app, which the sync group's export control and the toasts need.
vi.mock('../src/apps/loans/workbook/presentation/LocalLoansStatus.vue', () => ({ default: {} }))
vi.mock('@nuxt/ui/composables/useToast', () => ({ useToast: () => ({ add: (toast: { readonly title: string }) => toasts.push(toast) }) }))

/** Google's answer to a tap whose trip left the page to find the app's file. */
function findAnswer(app: string): RedirectReturn {
  return {
    kind: 'granted',
    token: { value: 'fake-token', scopes: ['drive.file'], expiresAt: Date.now() + 3_600_000 },
    asked: ['drive.file'],
    resume: 'find',
    app,
    route: `#/${app}/start?step=find`,
    ask: 'tap',
  }
}

/** The router of a page that came back to the Loans find step, which notes where the app sends it. */
const pushed: string[] = []
const router = {
  isReady: async () => {},
  currentRoute: { value: { path: '/loans/start' } },
  push: async (to: string) => {
    pushed.push(to)
  },
} as unknown as Router

beforeAll(async () => {
  vi.stubEnv('VITE_FAKE_WORKBOOK', 'true')
  await seedFakeWorkbook(null, () => null)
  await seedFakeLoans('other-device')
})

describe('a find a trip to Google resumes', () => {
  it("leaves the Loans file unchosen when the company's find comes back", async () => {
    const companyFind = findAnswer('company')

    loansApp.start(router, resumedBy(companyFind, 'loans'))
    await useLoansBooks().open()

    expect(useLoansBooks().state.choice).toBeNull()
    expect(toasts).toEqual([])
    expect(pushed).toEqual([])
  })

  it('opens the Loans file another device made, found by its mark, ends on the Loans Overview, and leaves the company books as they were', async () => {
    const companyBefore = loadWorkbookChoice('company')
    const loansFind = findAnswer('loans')

    expect(resumedBy(loansFind, 'company')).toBeNull()
    loansApp.start(router, resumedBy(loansFind, 'loans'))

    await vi.waitFor(() => expect(useLoansBooks().state.choice).toMatchObject({ source: 'drive', name: 'kuna-loans.json' }))
    expect(toasts.map((toast) => toast.title)).toEqual(['Opened kuna-loans.json'])
    await vi.waitFor(() => expect(pushed).toEqual(['/loans']))
    expect(loadWorkbookChoice('company')).toEqual(companyBefore)
  })
})
