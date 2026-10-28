import { describe, expect, it } from 'vitest'

import type { AppContribution } from '../src/shared/app/appContribution'
import { firstRunAt } from '../src/shell/routing/appRegistry'

/** An installed app as the first run reads it: its id and whether it has nothing to show yet. */
function appOf(id: string, firstRun: boolean): AppContribution {
  return { id, firstRun: () => firstRun, startPath: `/${id}/start` } as AppContribution
}

describe('the first run that takes the page', () => {
  it("is the home app's on a fresh device, whatever the address", () => {
    const company = appOf('company', true)
    const loans = appOf('loans', true)

    for (const path of ['/company/review', '/loans', '/settings']) {
      expect(firstRunAt([company, loans], path)).toBe(company)
    }
  })

  it("is another app's only on an address under it", () => {
    const company = appOf('company', false)
    const loans = appOf('loans', true)

    expect(firstRunAt([company, loans], '/loans')).toBe(loans)
    expect(firstRunAt([company, loans], '/loans/start')).toBe(loans)
    expect(firstRunAt([company, loans], '/company')).toBeNull()
    expect(firstRunAt([company, loans], '/settings')).toBeNull()
    expect(firstRunAt([company, loans], '/loansbook')).toBeNull()
  })

  it('is none once every app has something to show', () => {
    expect(firstRunAt([appOf('company', false), appOf('loans', false)], '/loans')).toBeNull()
  })
})
