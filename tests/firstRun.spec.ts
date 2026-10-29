import { describe, expect, it } from 'vitest'

import type { AppContribution } from '../src/shared/app/appContribution'
import { firstRunAt } from '../src/shell/routing/appRegistry'

/** An installed app as the first run reads it: its id and whether it has nothing to show yet. */
function appOf(id: string, firstRun: boolean): AppContribution {
  return { id, firstRun: () => firstRun, startPath: `/${id}/start` } as AppContribution
}

describe('the first run that takes the page', () => {
  it("is an app's only on an address under it, so any app can be set up first", () => {
    const company = appOf('company', true)
    const loans = appOf('loans', true)

    expect(firstRunAt([company, loans], '/loans')).toBe(loans)
    expect(firstRunAt([company, loans], '/loans/start')).toBe(loans)
    expect(firstRunAt([company, loans], '/company/review')).toBe(company)
    expect(firstRunAt([company, loans], '/loansbook')).toBeNull()
  })

  it('leaves the home and Kuna settings to the shell on a fresh device', () => {
    const apps = [appOf('company', true), appOf('loans', true)]

    expect(firstRunAt(apps, '/')).toBeNull()
    expect(firstRunAt(apps, '/settings')).toBeNull()
  })

  it('is none for an app with something to show', () => {
    expect(firstRunAt([appOf('company', false), appOf('loans', true)], '/company')).toBeNull()
    expect(firstRunAt([appOf('company', false), appOf('loans', false)], '/loans')).toBeNull()
  })
})
