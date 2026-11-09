import { afterEach, describe, expect, it } from 'vitest'

import type { AppContribution, AppScreen, MenuCount } from '../src/shared/app/appContribution'
import { answerKunaStart, forgetKunaStart } from '../src/shared/app/kunaStart'
import { appAt, waitingIn } from '../src/shell/routing/appRegistry'
import { navigationOf } from '../src/shell/ui/navigation'

function screen(path: `/${string}`, title: string): AppScreen {
  return { path, title, icon: 'i-lucide-circle', component: () => Promise.resolve({}) }
}

const OVERVIEW = screen('/books', 'Overview')
const ROWS = screen('/books/rows', 'Rows')
const LIMITS = screen('/books/limits', 'Limits')
const SETTINGS = screen('/books/settings', 'Settings')

function appWith(counts: ReadonlyMap<AppScreen, MenuCount>, firstRun = false, id = 'books'): AppContribution {
  return {
    id,
    name: 'Books',
    colour: '--app-company',
    screens: [OVERVIEW, ROWS, LIMITS, SETTINGS],
    menu: () => [OVERVIEW, ROWS, LIMITS],
    settings: SETTINGS,
    menuCount: (shown: AppScreen) => counts.get(shown) ?? null,
    subtitle: () => 'Example Studio',
    homeCard: { icon: 'i-lucide-book', purpose: '', figures: () => null },
    firstRun: () => firstRun,
    startPath: '/books/start',
  } as unknown as AppContribution
}

describe('the count on a closed app', () => {
  it('adds up what waits over the menu', () => {
    const app = appWith(
      new Map([
        [ROWS, { count: 2 }],
        [LIMITS, { count: 3 }],
      ]),
    )
    expect(waitingIn(app)).toBe(5)
  })

  it('is zero with nothing waiting', () => {
    expect(waitingIn(appWith(new Map()))).toBe(0)
  })
})

describe('the app an address belongs to', () => {
  it('is the app that owns the path, or none', () => {
    const app = appWith(new Map())
    expect(appAt([app], '/books/rows')).toBe(app)
    expect(appAt([app], '/bookshelf')).toBeNull()
    expect(appAt([app], '/')).toBeNull()
  })
})

describe('the menu', () => {
  it("opens only the named app and lists its menu, then its Settings, with each item's count and where it opens", () => {
    const counted = appWith(new Map([[ROWS, { count: 2, opens: '/books/rows?tab=review' }]]))
    const other = appWith(new Map(), false, 'other')
    const [first, second] = navigationOf([counted, other], 'books').apps

    expect(first?.open).toBe(true)
    expect(second?.open).toBe(false)
    expect(first?.waiting).toBe(2)
    expect(first?.entries).toEqual([
      { to: '/books', label: 'Overview', icon: 'i-lucide-circle' },
      { to: '/books/rows?tab=review', label: 'Rows', icon: 'i-lucide-circle', count: 2 },
      { to: '/books/limits', label: 'Limits', icon: 'i-lucide-circle' },
      { to: '/books/settings', label: 'Settings', icon: 'i-lucide-circle' },
    ])
  })

  afterEach(() => {
    forgetKunaStart()
  })

  it('offers no Add an app until the welcome has an answer', () => {
    expect(navigationOf([appWith(new Map()), appWith(new Map(), true, 'other')], null).addApp).toBeNull()
  })

  it('leaves out an app in its first run and offers Add an app', () => {
    answerKunaStart({ apps: ['other'], home: 'drive' })
    const inUse = appWith(new Map())
    const unused = appWith(new Map(), true, 'other')
    const { apps, addApp, netWorth } = navigationOf([inUse, unused], null)

    expect(apps.map((app) => app.id)).toEqual(['books'])
    expect(addApp).toMatchObject({ to: '/', label: 'Add an app' })
    expect(netWorth).not.toBeNull()
  })

  it('offers no Add an app with every app in use', () => {
    expect(navigationOf([appWith(new Map())], null).addApp).toBeNull()
  })

  it('shows Add an app and no Net worth before any app is set up', () => {
    answerKunaStart({ apps: ['books'], home: 'drive' })
    const { apps, addApp, netWorth, kunaSettings } = navigationOf([appWith(new Map(), true)], null)

    expect(apps).toEqual([])
    expect(addApp).not.toBeNull()
    expect(netWorth).toBeNull()
    expect(kunaSettings).toMatchObject({ to: '/settings', label: 'Kuna settings' })
  })

  it('holds Net worth and Kuna settings once an app is in use', () => {
    const { netWorth, kunaSettings } = navigationOf([appWith(new Map())], null)

    expect(netWorth).toMatchObject({ to: '/overview', label: 'Net worth' })
    expect(kunaSettings).toMatchObject({ to: '/settings', label: 'Kuna settings' })
  })
})

describe('the menu item a record opens from', () => {
  it("lights the screen it is under by the screen's path, even while its count points at a tab", () => {
    const app = appWith(new Map([[ROWS, { count: 2, opens: '/books/rows?tab=review' }]]))
    const [books] = navigationOf([app], 'books', '/books/rows').apps

    expect(books?.entries.filter((entry) => entry.lit === true)).toEqual([{ to: '/books/rows?tab=review', label: 'Rows', icon: 'i-lucide-circle', count: 2, lit: true }])
  })

  it('lights a screen without a count', () => {
    const [books] = navigationOf([appWith(new Map())], 'books', '/books/limits').apps

    expect(books?.entries.find((entry) => entry.lit === true)?.label).toBe('Limits')
  })

  it('lights nothing on a screen that is not under another', () => {
    const { apps, netWorth, kunaSettings } = navigationOf([appWith(new Map())], 'books', null)

    expect(apps.flatMap((app) => app.entries).some((entry) => entry.lit === true)).toBe(false)
    expect(netWorth?.lit).toBeUndefined()
    expect(kunaSettings.lit).toBeUndefined()
  })
})
