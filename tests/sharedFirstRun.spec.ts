// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createApp } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import { useFirstRun } from '../src/shared/storage/presentation/useFirstRun'

const screen = { render: () => null }

async function startAt(startRoute: string, overviewRoute: string, address: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: startRoute, component: screen },
      { path: overviewRoute, component: screen },
    ],
  })
  await router.push(address)
  const app = createApp(screen).use(router)
  const steps = app.runWithContext(() => useFirstRun({ startRoute, overviewRoute }))
  return { router, steps }
}

describe('the shared first run routing', () => {
  it.each([
    ['/one/start', '/one'],
    ['/two/start', '/two'],
  ])('names the step in the query of %s and falls back to home for any other word', async (startRoute, overviewRoute) => {
    const folder = await startAt(startRoute, overviewRoute, `${startRoute}?step=folder`)
    expect(folder.steps.step.value).toBe('folder')

    const unknown = await startAt(startRoute, overviewRoute, `${startRoute}?step=elsewhere`)
    expect(unknown.steps.step.value).toBe('home')

    const bare = await startAt(startRoute, overviewRoute, startRoute)
    expect(bare.steps.step.value).toBe('home')
  })

  it('moves to a step with the query and back home without it', async () => {
    const { router, steps } = await startAt('/two/start', '/two', '/two/start')

    await steps.go('find')
    expect(router.currentRoute.value.fullPath).toBe('/two/start?step=find')
    expect(steps.step.value).toBe('find')

    await steps.go('home')
    expect(router.currentRoute.value.fullPath).toBe('/two/start')
    expect(steps.step.value).toBe('home')
  })

  it('finishes on the overview of its own app', async () => {
    const { router, steps } = await startAt('/one/start', '/one', '/one/start?step=folder')

    await steps.finish()
    expect(router.currentRoute.value.fullPath).toBe('/one')
  })
})
