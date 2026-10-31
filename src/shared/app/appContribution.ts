import type { Component } from 'vue'
import type { LocationQuery, RouteComponent, RouteLocationRaw, Router } from 'vue-router'

import type { RedirectReturn } from '../google/googleRedirect'
import type { MoneyFormat, MoneyTone, SignDisplay } from '../money/moneyFormat'
import type { AppSyncGroup } from '../sync/presentation/pageSync'

/** A screen of an app, on a route under the app's id such as `/company/transactions`. Each one loads as its own chunk. */
export interface AppScreen {
  readonly path: `/${string}`
  readonly title: string
  readonly icon: string
  readonly component: () => Promise<RouteComponent>
  /** Shown without the menu, as a first run is, and the browser tab says only Kuna. */
  readonly bare?: true
}

/** An old address of the app, which opens the screen and tab that now hold what it showed. */
export interface MovedScreen {
  readonly path: `/${string}`
  /** Where the old address opens, from the query it came with. */
  readonly to: (query: LocationQuery) => RouteLocationRaw
}

/** A figure on the app's card on the Kuna home, such as cash on hand. */
export interface HomeAmount {
  readonly label: string
  readonly cents: number
  /** As on `MoneyText`, such as `always` for a gain that shows its plus. */
  readonly sign?: SignDisplay
  /** As on `MoneyText`, such as `outcome` for a gain that is green and a loss that is red. */
  readonly tone?: MoneyTone
}

/** What the app's card on the Kuna home shows while the app's books are on screen. */
export interface HomeFigures {
  /** The first one leads the card. */
  readonly amounts: readonly HomeAmount[]
  /** What waits in the app, such as "3 rows to review", or null when nothing does. */
  readonly waiting: string | null
}

/** The app's card on the Kuna home. */
export interface AppHomeCard {
  /** A Lucide icon name such as `i-lucide-landmark`. */
  readonly icon: string
  /** What the app keeps, shown while it has no figures, such as before it is set up. */
  readonly purpose: string
  /** Null while the app has nothing to show yet, `opening` while its books are being read, and `failed` when reading them failed. */
  figures(): HomeFigures | 'opening' | 'failed' | null
}

/** What an app gives the shell: its screens and menu, its card on the home, its first run, its part of the page's sync, and what runs while the page is open. */
export interface AppContribution {
  /** The first part of every route of the app, and the app the document names. */
  readonly id: string
  /** The app's name, over its menu and on its card on the home, and in the browser tab of its screens, such as Company. */
  readonly name: string
  /** The custom property of the app's identity colour, such as `--app-company`, on the tile of its icon on the home card, in its menu and in the phone top bar. */
  readonly colour: `--${string}`
  /** Called once before the router is made and before any books are read. */
  install(): Promise<void>
  /** Every route of the app, whatever its settings switch on, its Settings included. The first one is where the app opens. */
  readonly screens: readonly AppScreen[]
  /** Old addresses that open where their screens moved, so a link kept from before still lands. */
  readonly moved?: readonly MovedScreen[]
  /** The menu items, in order, without Settings. */
  menu(): readonly AppScreen[]
  /** The app's Settings, one of its screens, set apart at the foot of its menu. */
  readonly settings: AppScreen
  /** What waits on a screen, shown beside its menu item, or null for none. */
  menuCount(screen: AppScreen): number | null
  /** The line under the app's name in the menu and on its card, such as the company the books belong to. */
  subtitle(): string | null
  /** The currency and number locale of the app's books, which its screens and its card on the home format money in. */
  moneyFormat(): MoneyFormat
  readonly homeCard: AppHomeCard
  /** True while the app has nothing to show, so the shell sends an address under the app to `startPath`, and its card on the home offers Set up. */
  firstRun(): boolean
  readonly startPath: `/${string}`
  /** The app's part of the page's one sync, which the shell asks for once as it starts. */
  syncGroup(): AppSyncGroup
  /** The app's own specimens for the gallery, which only development and fake builds load. */
  readonly gallery?: () => Promise<Component>
  /** Whether the page should fetch its Google token on the way in, with no screen at Google. */
  asksGoogleOnOpen(): boolean
  /**
   * Starts what runs while the page is open, from the shell's setup. `googleReturn` is Google's
   * answer to a trip the app's own find or pick asked for, or null. Returns the function that stops it.
   */
  start(router: Router, googleReturn: RedirectReturn | null): () => void
}
