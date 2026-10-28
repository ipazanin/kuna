import type { Component } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

import type { AppScreen, AppSettingsTab } from '../../../shared/app/appContribution'
import type { CivilDate } from '../../../shared/calendar/civilDate'
import type { MailSource } from '../mail/application/mailFiling'
import type { WaitingJob } from '../overview/presentation/waitingForYou'
import type { Settings } from '../settings/domain/settings'
import type { FilteredLedger } from '../transactions/application/useFilteredLedger'
import type { PackPart } from '../workbook/domain/packPart'
import type { Workbook } from '../workbook/domain/workbook'

/**
 * A card on Review's Queue tab, under the rows to review. It takes `busy`, true while another write
 * runs, and stays mounted while it shows nothing, so a dialog it opened outlives the card.
 */
export interface PackReviewCard {
  readonly component: Component
  /** Whether the card has something for the rows in view, so Review can say nothing waits when no card does. */
  shows(ledger: FilteredLedger): boolean
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
  /** The books with these facts in place of theirs, as a save of them leaves the books, so the steps they switch on can be read before it. */
  withFacts(workbook: Workbook, facts: Facts): Workbook
}

/** What onboarding asks for the pack: one question whose Yes switches on the owner-pay module. */
export interface PackOnboarding {
  readonly question: string
  /** What Yes adds, said as the answer. */
  readonly yes: string
}

/** What a pack adds to the core screens and figures. Its components are async, so the pack's code loads only with them. */
export interface PackContribution {
  /** The pack's part of the workbook, read whatever the owner-pay switch says. */
  readonly workbook: PackPart<unknown, unknown> | null
  /** Screens of the pack's own, listed after the core screens. The routes exist whatever the switch says, and their menu items show only while it is on, like the slots below. */
  readonly screens: readonly AppScreen[]
  /** Jobs for Overview's Waiting for you, listed after the core jobs. */
  waitingJobs(workbook: Workbook, asOf: CivilDate): readonly WaitingJob[]
  readonly reviewCards: readonly PackReviewCard[]
  /** Tabs of Settings, after Accounts. */
  readonly settingsTabs: readonly AppSettingsTab[]
  /** Cards on Settings, General, under the settings form. */
  readonly settingsCards: readonly Component[]
  readonly companyFacts: PackCompanyFacts<unknown> | null
  /** Where the spending breakdown links a cost group the pack breaks down further. */
  costGroupLinks(group: string): { readonly label: string; readonly to: RouteLocationRaw } | null
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
  mailSources: [],
  onboarding: null,
}

let installed: PackContribution = NO_PACK

/** Called once by the company app's install, before the router is made. */
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
