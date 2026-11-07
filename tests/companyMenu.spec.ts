import { describe, expect, it, vi } from 'vitest'

import type { Transaction } from '../src/apps/company/workbook/domain/workbook'

// The app takes the store's state once, as it loads, so each test changes the books in that state.
const store = vi.hoisted(() => ({
  state: { workbook: null as { transactions: readonly Pick<Transaction, 'flaggedBy' | 'bucket' | 'reviewReasons'>[] } | null, choice: null, status: 'ready' },
}))

vi.mock('../src/apps/company/workbook/application/workbookStore', () => ({ useWorkbook: () => store }))
// The specs run without the Vue compiler or Nuxt UI's app, which the sync group's export control and the toasts need.
vi.mock('../src/apps/company/workbook-files/presentation/LocalWorkbookStatus.vue', () => ({ default: {} }))
vi.mock('@nuxt/ui/composables/useToast', () => ({ useToast: () => ({ add: () => undefined }) }))

const { companyApp } = await import('../src/apps/company/app')

const settled = { flaggedBy: 'rule', bucket: 'operating', reviewReasons: [] } as const
const waiting = { ...settled, flaggedBy: 'ai' } as const

function transactionsItem() {
  const screen = companyApp.menu().find((candidate) => candidate.path === '/company/transactions')
  if (screen === undefined) throw new Error('The Company menu has no Transactions item.')
  return companyApp.menuCount!(screen)
}

describe("the Company menu's Transactions item", () => {
  it('counts the rows that wait and opens on the To review tab while any wait', () => {
    store.state.workbook = { transactions: [settled, waiting, waiting] }

    expect(transactionsItem()).toEqual({ count: 2, opens: '/company/transactions?tab=review' })
  })

  it('shows no count and opens the usual list when nothing waits', () => {
    store.state.workbook = { transactions: [settled] }

    expect(transactionsItem()).toBeNull()
  })

  it('counts nothing beside the other items', () => {
    store.state.workbook = { transactions: [waiting] }

    const others = companyApp.menu().filter((screen) => screen.path !== '/company/transactions')

    expect(others.map((screen) => companyApp.menuCount!(screen))).toEqual(others.map(() => null))
  })
})
