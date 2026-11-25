import { createApp, shallowRef } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'

import type { DateRange } from '../src/shared/calendar/dateRange'
import type { ChartRange } from '../src/shared/charts/chartRange'
import { useChartRange } from '../src/shared/charts/useChartRange'
import { civil } from './fixtures/ledger'

const TODAY = civil('2026-11-03')

async function rangeAt(address: string, span: { value: DateRange | null }, opening?: ChartRange) {
  const router = createRouter({ history: createMemoryHistory(), routes: ['/loans/bank-loan', '/investments/holding'].map((path) => ({ path, component: { render: () => null } })) })
  await router.push(address)
  const app = createApp({}).use(router)
  return {
    router,
    choice: app.runWithContext(() =>
      useChartRange(
        () => span.value,
        () => TODAY,
        ...(opening === undefined ? [] : [() => opening]),
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

  it('reads and writes a custom range in the address, and keeps its days as the window', async () => {
    const { router, choice } = await rangeAt('/loans/bank-loan?loan=home&range=2024-02-01..2024-06-30', shallowRef({ from: civil('2023-03-31'), to: civil('2048-03-01') }))

    expect(choice.range.value).toEqual({ from: civil('2024-02-01'), to: civil('2024-06-30') })
    expect(choice.window.value).toEqual({ from: civil('2024-02-01'), to: civil('2024-06-30') })
    choice.range.value = { from: civil('2025-01-01'), to: civil('2025-03-31') }
    await settle()
    expect(router.currentRoute.value.query).toEqual({ loan: 'home', range: '2025-01-01..2025-03-31' })
  })

  it('reads a custom range that misses the span, or comes where no preset is offered, as the opening range', async () => {
    const loan = shallowRef<DateRange | null>({ from: civil('2023-03-31'), to: civil('2048-03-01') })
    expect((await rangeAt('/loans/bank-loan?range=2019-01-01..2019-12-31', loan)).choice.range.value).toBe('all')
    const young = shallowRef<DateRange | null>({ from: civil('2026-03-31'), to: civil('2026-11-01') })
    expect((await rangeAt('/loans/bank-loan?range=2026-04-01..2026-06-30', young)).choice.range.value).toBe('all')
  })

  it('opens on a range of its own, which stays out of the address, and writes All once picked', async () => {
    const held = { from: civil('2023-01-09'), to: TODAY }
    const { router, choice } = await rangeAt('/investments/holding?instrument=tech', shallowRef({ from: civil('2019-01-31'), to: TODAY }), held)

    expect(choice.range.value).toEqual(held)
    choice.range.value = 'all'
    await settle()
    expect(router.currentRoute.value.query).toEqual({ instrument: 'tech', range: 'all' })
    expect(choice.range.value).toBe('all')
    choice.range.value = { ...held }
    await settle()
    expect(router.currentRoute.value.query).toEqual({ instrument: 'tech' })
  })
})
