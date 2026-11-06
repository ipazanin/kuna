import type { Component } from 'vue'
import type { RouteComponent, RouteLocationRaw, Router } from 'vue-router'

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

/** What waits on a screen, shown beside its menu item. */
export interface MenuCount {
  /** Always above zero, since a screen with nothing waiting has no count at all. */
  readonly count: number
  /** Where the menu item opens while something waits, when that is not the screen itself, such as its To review tab. */
  readonly opens?: string
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

/** One thing an app still lacks, said in a line. */
export interface SetUpLine {
  readonly key: string
  readonly text: string
  /** The screen that does it, or none for a line only the home card shows, whose screen already leads with it. */
  readonly link?: { readonly label: string; readonly to: RouteLocationRaw }
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

/** A figure of the app on Net worth, which opens the screen it comes from. */
export interface HubPart {
  readonly label: string
  readonly cents: number
  readonly caption: string | null
  readonly to: RouteLocationRaw
}

/** A part of the sum Net worth leads with: what you have, or what you owe, which is taken off. */
export interface CountedHubPart extends HubPart {
  readonly side: 'has' | 'owes'
}

/** What the app shows on Net worth. */
export interface HubFigures<Part extends HubPart = HubPart> {
  readonly parts: readonly Part[]
  /** Lines under the parts, such as what they leave out ("1 holding without a price") or why there are none. */
  readonly notes: readonly string[]
}

/** Null while the app has nothing to show, `opening` while its books are being read, and `failed` when reading them failed. */
export type HubState<Part extends HubPart = HubPart> = HubFigures<Part> | 'opening' | 'failed' | null

/**
 * The app's part of Net worth. An app that counts adds its parts into the sum, and its wait or its failure
 * holds the sum back. One that does not, such as the company, shows its parts beside the sum and never in it.
 */
export type AppHub = { readonly counts: true; figures(): HubState<CountedHubPart> } | { readonly counts: false; figures(): HubState }

/** The switch a task needs before it may send employee names or pay, with what it says as it asks. */
export interface AssistEmployeeSwitch {
  /** Its label on the Assistant card, such as "Include rows paid to employees". */
  readonly label: string
  /** What switching it on sends, to the provider named. */
  warning(provider: string): string
}

/** What one task sends, for the Assistant card and the first-use dialog. */
export interface AssistTaskSummary {
  readonly id: `${string}.${string}`
  readonly title: string
  /** What leaves the device, in one plain sentence. */
  readonly sends: string
  /** The switch of a task that can send employee names or pay, or null for one that never does. */
  readonly employees: AssistEmployeeSwitch | null
}

/** What the app's assistant may do, for the Assistant card in Kuna settings. */
export interface AppAssist {
  /** Its tasks as the books on screen offer them, a pack's among them while the pack shows. */
  tasks(): readonly AssistTaskSummary[]
}

/** The app that is better set up first, and what a person gains by it. */
export interface SetUpOrder {
  readonly after: string
  readonly why: string
}

/** What an app gives the shell: its screens and menu, its card on the home, its figures on Net worth, its first run, its part of the page's sync, and what runs while the page is open. */
export interface AppContribution {
  /** The first part of every route of the app, and the app the document names. */
  readonly id: string
  /** The app's name, on its row in the menu and its card on the home, and in the browser tab of its screens, such as Company. */
  readonly name: string
  /** The custom property of the app's identity colour, such as `--app-company`, on the tile of its icon on the home card, on its row in the menu and in the phone top bar. */
  readonly colour: `--${string}`
  /** Called once before the router is made and before any books are read. */
  install(): Promise<void>
  /** Every route of the app, whatever its settings switch on, its Settings included. The first one is where the app opens. */
  readonly screens: readonly AppScreen[]
  /** The menu items, in order, without Settings. */
  menu(): readonly AppScreen[]
  /** The app's Settings, one of its screens, last among its pages in the menu. */
  readonly settings: AppScreen
  /** What waits on a screen, shown beside its menu item, or null when nothing waits. */
  menuCount(screen: AppScreen): MenuCount | null
  /** The line under the app's name in the menu and on its card, such as the company the books belong to. */
  subtitle(): string | null
  /** The currency and number locale of the app's books, which its screens and its card on the home format money in. */
  moneyFormat(): MoneyFormat
  readonly homeCard: AppHomeCard
  /** Its figures on Net worth, for an app that has any. */
  readonly hub?: AppHub
  /** What the app still lacks, most pressing first, gone one by one as it is done. None while it has no file open. */
  setUpLines(): readonly SetUpLine[]
  /** True while the app has nothing to show, so the shell sends an address under the app to `startPath`, the menu leaves it out, and its card on the home offers Set up. */
  firstRun(): boolean
  readonly startPath: `/${string}`
  /** The order the home welcome suggests when the person picks both apps. It is a suggestion, and no first run waits for it. */
  readonly setUpOrder?: SetUpOrder
  /** The app's part of the page's one sync, which the shell asks for once as it starts. */
  syncGroup(): AppSyncGroup
  /** The app's own specimens for the gallery, which only development and fake builds load. */
  readonly gallery?: () => Promise<Component>
  /** What the app's assistant may do, for an app that has one. */
  readonly assist?: AppAssist
  /** Whether the page should fetch its Google token on the way in, with no screen at Google. */
  asksGoogleOnOpen(): boolean
  /**
   * Starts what runs while the page is open, from the shell's setup. `googleReturn` is Google's
   * answer to a trip the app's own find or pick asked for, or null. Returns the function that stops it.
   */
  start(router: Router, googleReturn: RedirectReturn | null): () => void
}
