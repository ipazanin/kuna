import { createApp, shallowRef } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'

import type { DateRange } from '../src/shared/calendar/dateRange'
import { useChartRange } from '../src/shared/charts/useChartRange'
import { civil } from './fixtures/ledger'

const TODAY = civil('2026-11-03')

async function rangeAt(address: string, span: { value: DateRange | null }) {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/loans/bank-loan', component: { render: () => null } }] })
  await router.push(address)
  const app = createApp({}).use(router)
  return {
    router,
    choice: app.runWithContext(() =>
      useChartRange(
        () => span.value,
        () => TODAY,
      ),
    ),
  }
}

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

describe("a screen's chart range", () => {
  it('reads the range from the address and keeps the days it covers', async () => {
    // A loan from Mar 2023 to Mar 2048 offers the last year and three, the next five and All.
    const { choice } = await rangeAt('/loans/bank-loan?loan=home&range=1y', shallowRef({ from: civil('2023-03-31'), to: civil('2048-03-01') }))

    expect(choice.ranges.value).toEqual(['1y', '3y', 'next-5y', 'all'])
    expect(choice.range.value).toBe('1y')
    expect(choice.window.value).toEqual({ from: civil('2025-11-03'), to: TODAY })
  })

  it('reads a range the chart does not offer as All, and with no span offers only All', async () => {
    const young = shallowRef<DateRange | null>({ from: civil('2026-03-31'), to: civil('2026-11-01') })
    const { choice } = await rangeAt('/loans/bank-loan?range=5y', young)

    expect(choice.range.value).toBe('all')
    expect(choice.window.value).toBeNull()
    young.value = null
    expect(choice.ranges.value).toEqual(['all'])
  })

  it('writes a pick to the address beside the other choices and leaves All out of it', async () => {
    const { router, choice } = await rangeAt('/loans/bank-loan?loan=home', shallowRef({ from: civil('2023-03-31'), to: civil('2048-03-01') }))

    choice.range.value = 'next-5y'
    await settle()
    expect(router.currentRoute.value.query).toEqual({ loan: 'home', range: 'next-5y' })
    expect(choice.window.value).toEqual({ from: TODAY, to: civil('2031-11-03') })

    choice.range.value = 'all'
    await settle()
    expect(router.currentRoute.value.query).toEqual({ loan: 'home' })
  })
})
