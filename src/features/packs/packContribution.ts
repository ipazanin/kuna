import type { Component } from 'vue'
import type { RouteComponent, RouteLocationRaw } from 'vue-router'

import type { CivilDate } from '../../shared/calendar/civilDate'
import type { MailSource } from '../mail/application/mailFiling'
import type { WaitingJob } from '../overview/presentation/waitingForYou'
import type { Settings } from '../settings/domain/settings'
import type { SyncStep } from '../sync/application/sync'
import type { FilteredLedger } from '../transactions/application/useFilteredLedger'
import type { PackPart } from '../workbook/domain/packPart'
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

/**
 * The facts card of Settings, General, saved with the rest of the settings by one Save. The facts
 * are the values of the pack's settings keys, which its part of the workbook holds.
 */
export interface PackCompanyFacts<Facts> {
  /** Takes `facts`, `saved` and `errors`, and emits `update` with the edited facts. */
  readonly card: Component
  /** The facts as the workbook holds them, or their defaults before there is a workbook. */
  factsOf(workbook: Workbook | null): Facts
  /** What is wrong with the drafted facts, by field. Empty when they may be saved. */
  errors(facts: Facts): Readonly<Record<string, string>>
}

/** A Drive folder the pack reads, by the settings key that names it as a path from My Drive. */
export interface PackDriveFolder {
  readonly key: string
  /** What the folder holds, as a sentence names it, such as "the accountant's VAT returns". */
  readonly holds: string
}

/** What onboarding asks for the pack: one question whose Yes switches on the owner-pay module, and the folders the pack reads. */
export interface PackOnboarding {
  readonly question: string
  /** What Yes adds, said as the answer. */
  readonly yes: string
  readonly folders: readonly PackDriveFolder[]
  /** Where the folders are set once onboarding is over. */
  readonly foldersAt: RouteLocationRaw
}

/** What a pack adds to the core screens and figures. Its components are async, so the pack's code loads only with them. */
export interface PackContribution {
  /** The pack's part of the workbook, read whatever the owner-pay switch says. */
  readonly workbook: PackPart<unknown, unknown> | null
  /** The routes exist whatever the switch says. Their menu items show only while it is on, like the slots below. */
  readonly screens: readonly PackScreen[]
  /** Jobs for Overview's Waiting for you, listed after the core jobs. */
  waitingJobs(workbook: Workbook, asOf: CivilDate): readonly WaitingJob[]
  readonly reviewCards: readonly PackReviewCard[]
  readonly settingsTabs: readonly PackSettingsTab[]
  /** Cards on Settings, General, under the settings form. */
  readonly settingsCards: readonly Component[]
  readonly companyFacts: PackCompanyFacts<unknown> | null
  /** Where the spending breakdown links a cost group the pack breaks down further. */
  costGroupLinks(group: string): { readonly label: string; readonly to: RouteLocationRaw } | null
  /** Steps a sync runs after core's, in order. */
  readonly syncSteps: readonly SyncStep[]
  /** Kinds of mail the sync's mail step looks for after core's, in order. */
  readonly mailSources: readonly MailSource[]
  readonly onboarding: PackOnboarding | null
}

const NO_PACK: PackContribution = {
  workbook: null,
  screens: [],
  waitingJobs: () => [],
  reviewCards: [],
  settingsTabs: [],
  settingsCards: [],
  companyFacts: null,
  costGroupLinks: () => null,
  syncSteps: [],
  mailSources: [],
  onboarding: null,
}

let installed: PackContribution = NO_PACK

/** Called once by main.ts, before the router is made. */
export function installPack(pack: PackContribution): void {
  installed = pack
}

/** The installed pack, for its routes and its part of the workbook. */
export function installedPack(): PackContribution {
  return installed
}

/** The installed pack while the owner-pay switch is on, and no pack while it is off. */
export function shownPack(settings: Pick<Settings, 'ownerPayModule'>): PackContribution {
  return settings.ownerPayModule ? installed : NO_PACK
}
