import type { Component, InjectionKey, Ref } from 'vue'
import type { RouteComponent, Router } from 'vue-router'

import type { RedirectReturn } from '../google/googleRedirect'

/** A screen of an app, on a route under the app's id such as `/company/transactions`. Each one loads as its own chunk. */
export interface AppScreen {
  readonly path: `/${string}`
  readonly title: string
  readonly icon: string
  readonly component: () => Promise<RouteComponent>
  /** Shown without the menu, and the browser tab keeps the app's name, as onboarding is. */
  readonly bare?: true
}

/** A tab of Settings, before the shell's This device. */
export interface AppSettingsTab {
  readonly value: string
  readonly label: string
  readonly icon: string
  readonly component: Component
}

/** What an app adds to the shell's Settings screen. */
export interface AppSettings {
  tabs(): readonly AppSettingsTab[]
  /** Cards on This device, before the shell's. */
  deviceCards(): readonly Component[]
  /** The text under the Settings heading. */
  intro(): string
}

/** The Settings tab a link from another screen opened, until another tab is picked, so its cards open even where this device keeps them collapsed. */
export const LINKED_SETTINGS_TAB: InjectionKey<Readonly<Ref<string | null>>> = Symbol('linked settings tab')

/** What an app gives the shell: its screens and menu, its first run, its parts of the top bar and of Settings, and what runs while the page is open. */
export interface AppContribution {
  /** The first part of every route of the app, and the app the document names. */
  readonly id: string
  /** Called once before the router is made and before any books are read. */
  install(): Promise<void>
  /** Every route of the app, whatever its settings switch on. The first one is where the app opens. */
  readonly screens: readonly AppScreen[]
  /** The menu items, in order. */
  menu(): readonly AppScreen[]
  /** What waits on a screen, shown beside its menu item, or null for none. */
  menuCount(screen: AppScreen): number | null
  /** The line under the app's name, such as the company the books belong to. */
  subtitle(): string | null
  /** True while the app has nothing to show, so the shell sends the page to `startPath`. */
  firstRun(): boolean
  readonly startPath: `/${string}`
  /** The top bar's sync control. It takes `compact`, the narrow form. */
  readonly syncControl: Component
  /** The app's parts of Settings, loaded with the Settings screen's code. */
  settings(): Promise<AppSettings>
  /** Whether the page should fetch its Google token on the way in, with no screen at Google. */
  asksGoogleOnOpen(): boolean
  /** Starts what runs while the page is open, from the shell's setup. Returns the function that stops it. */
  start(router: Router, googleReturn: RedirectReturn | null): () => void
}
