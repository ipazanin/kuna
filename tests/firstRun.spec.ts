import { describe, expect, it } from 'vitest'

import type { AppContribution } from '../src/shared/app/appContribution'
import { entryPath, firstRunAt } from '../src/shell/routing/appRegistry'

/** An installed app as the first run reads it: its id, whether it has nothing to show yet, and its first screen. */
function appOf(id: string, firstRun: boolean): AppContribution {
  return { id, firstRun: () => firstRun, startPath: `/${id}/start`, screens: [{ path: `/${id}` }] } as unknown as AppContribution
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

describe('where the home leads into an app', () => {
  it('is its first run while it has nothing to show, and its first screen after', () => {
    expect(entryPath(appOf('loans', true))).toBe('/loans/start')
    expect(entryPath(appOf('loans', false))).toBe('/loans')
  })
})
