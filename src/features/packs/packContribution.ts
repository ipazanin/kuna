import type { Component } from 'vue'
import type { RouteComponent, RouteLocationRaw } from 'vue-router'

import type { CivilDate } from '../../shared/calendar/civilDate'
import type { WaitingJob } from '../overview/presentation/waitingForYou'
import type { CompanyFacts, Settings, SettingsField } from '../settings/domain/settings'
import type { FilteredLedger } from '../transactions/application/useFilteredLedger'
import type { Workbook } from '../workbook/domain/workbook'

/** A screen of its own, with its menu item after the core screens and before Settings. */
export interface PackScreen {
  readonly path: `/${string}`
  readonly title: string
  readonly icon: string
  readonly component: () => Promise<RouteComponent>
}

/**
 * A card on Review's Queue tab, under the rows to review. It takes `busy`, true while another write
 * runs, and stays mounted while it shows nothing, so a dialog it opened outlives the card.
 */
export interface PackReviewCard {
  readonly component: Component
  /** Whether the card has something for the rows in view, so Review can say nothing waits when no card does. */
  shows(ledger: FilteredLedger): boolean
}

/** A tab of Settings, after Accounts. */
export interface PackSettingsTab {
  readonly value: string
  readonly label: string
  readonly icon: string
  readonly component: Component
}

/** The facts card of Settings, General, saved with the rest of the settings by one Save. */
export interface PackCompanyFacts {
  /** Takes `facts`, `saved` and `errors`, and emits `update` with the edited facts. */
  readonly card: Component
  /** Checks only the pack can make, such as whether its tax tables know the owner's city. */
  errors(facts: CompanyFacts): Partial<Record<SettingsField, string>>
}

/** What a pack adds to the core screens and figures. Its components are async, so the pack's code loads only with them. */
export interface PackContribution {
  /** The ledger rows the pack keeps whole, by their row, with the names that claim them. Applies whatever the owner-pay switch says. */
  rowsKeptWhole(workbook: Pick<Workbook, 'assets' | 'transactions' | 'categories'>): ReadonlyMap<number, readonly string[]>
  /** The routes exist whatever the switch says. Their menu items show only while it is on, like the slots below. */
  readonly screens: readonly PackScreen[]
  /** Jobs for Overview's Waiting for you, listed after the core jobs. */
  waitingJobs(workbook: Workbook, asOf: CivilDate): readonly WaitingJob[]
  readonly reviewCards: readonly PackReviewCard[]
  readonly settingsTabs: readonly PackSettingsTab[]
  /** Cards on Settings, General, under the settings form. */
  readonly settingsCards: readonly Component[]
  readonly companyFacts: PackCompanyFacts | null
  /** Where the spending breakdown links a cost group the pack breaks down further. */
  costGroupLinks(group: string): { readonly label: string; readonly to: RouteLocationRaw } | null
}

const NO_PACK: PackContribution = {
  rowsKeptWhole: () => new Map(),
  screens: [],
  waitingJobs: () => [],
  reviewCards: [],
  settingsTabs: [],
  settingsCards: [],
  companyFacts: null,
  costGroupLinks: () => null,
}

let installed: PackContribution = NO_PACK

/** Called once by main.ts, before the router is made. */
export function installPack(pack: PackContribution): void {
  installed = pack
}

/** The installed pack, for its routes and its data slots. */
export function installedPack(): PackContribution {
  return installed
}

/** The installed pack while the owner-pay switch is on, and no pack while it is off. */
export function shownPack(settings: Pick<Settings, 'ownerPayModule'>): PackContribution {
  return settings.ownerPayModule ? installed : NO_PACK
}
