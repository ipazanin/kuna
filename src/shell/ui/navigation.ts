import type { AppContribution, AppScreen } from '../../shared/app/appContribution'
import { kunaStart } from '../../shared/app/kunaStart'
import { entryPath, waitingIn } from '../routing/appRegistry'
import { HOME_SCREEN, KUNA_SETTINGS_SCREEN, NET_WORTH_SCREEN } from '../routing/screens'
import { words } from './words'

export interface NavigationEntry {
  readonly to: string
  /** Its name in the menu, such as Overview. */
  readonly label: string
  /** A Lucide icon name such as `i-lucide-wallet`. */
  readonly icon: string
  /** What waits on the screen, such as the rows to review. Left out at zero. */
  readonly count?: number
  /** Lit as the current page while a screen opened from it shows, such as a holding under Holdings. */
  readonly lit?: true
}

/** An app's row in the menu, its icon on a tile in its colour, and the pages it shows while open. */
export interface NavigationApp {
  readonly id: string
  readonly to: string
  readonly name: string
  readonly icon: string
  readonly colour: `--${string}`
  readonly open: boolean
  /** What waits across the app's pages, which its row shows while they are closed. */
  readonly waiting: number
  /** A line for the open app, such as the company the books belong to. */
  readonly subtitle: string | null
  /** Its menu and its Settings. */
  readonly entries: readonly NavigationEntry[]
}

export interface Navigation {
  /** Null before any app is set up, when that page has nothing to show. */
  readonly netWorth: NavigationEntry | null
  /** The apps that are set up. */
  readonly apps: readonly NavigationApp[]
  /** The way to the home's cards, which offer every app, while any app is left out and the welcome has an answer. */
  readonly addApp: NavigationEntry | null
  readonly kunaSettings: NavigationEntry
}

function entryOf(screen: AppScreen, under: string | null = null): NavigationEntry {
  const entry = { to: screen.path, label: screen.title, icon: screen.icon }
  return screen.path === under ? { ...entry, lit: true } : entry
}

function menuEntriesOf(app: AppContribution, under: string | null): NavigationEntry[] {
  return app.menu().map((screen) => {
    const waiting = app.menuCount?.(screen) ?? null
    return waiting === null ? entryOf(screen, under) : { ...entryOf(screen, under), to: waiting.opens ?? screen.path, count: waiting.count }
  })
}

function navigationAppOf(app: AppContribution, openAppId: string | null, under: string | null): NavigationApp {
  return {
    id: app.id,
    to: entryPath(app),
    name: app.name,
    icon: app.homeCard.icon,
    colour: app.colour,
    open: app.id === openAppId,
    waiting: waitingIn(app),
    subtitle: app.subtitle(),
    entries: [...menuEntriesOf(app, under), entryOf(app.settings, under)],
  }
}

/**
 * The whole menu: Net worth, the apps in use with the open one showing its pages, and Kuna settings. An app in its first
 * run has no file, so it stays out, and `firstRun` stays false for a file still opening or one whose read failed.
 * `under` is the path of the menu screen the shown screen opens from, which the menu lights, or null.
 */
export function navigationOf(apps: readonly AppContribution[], openAppId: string | null, under: string | null = null): Navigation {
  const inUse = apps.filter((app) => !app.firstRun())
  return {
    netWorth: inUse.length === 0 ? null : entryOf(NET_WORTH_SCREEN),
    apps: inUse.map((app) => navigationAppOf(app, openAppId, under)),
    addApp: kunaStart() === null || inUse.length === apps.length ? null : { to: HOME_SCREEN.path, label: words.navigation.addApp, icon: 'i-lucide-plus' },
    kunaSettings: entryOf(KUNA_SETTINGS_SCREEN),
  }
}
