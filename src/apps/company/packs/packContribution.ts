import type { Component } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

import type { AppScreen, AssistTaskSummary } from '../../../shared/app/appContribution'
import type { CivilDate } from '../../../shared/calendar/civilDate'
import type { MailSource } from '../../../shared/mail-filing/application/mailFiling'
import type { WaitingJob } from '../overview/presentation/waitingForYou'
import type { Settings } from '../settings/domain/settings'
import type { SettingsTab } from '../settings/presentation/settingsTabs'
import type { FilteredLedger } from '../transactions/application/useFilteredLedger'
import type { PackPart } from '../workbook/domain/packPart'
import type { WorkbookRecords } from '../workbook/domain/readWorkbook'
import type { Category, Workbook } from '../workbook/domain/workbook'
import type { RecordProblem } from '../../../shared/storage/domain/recordsRead'
import type { Money } from '../../../shared/money/money'

/**
 * A card on the To review tab of Transactions, under the rows to review. It stays mounted while it shows nothing, so
 * a dialog it opened outlives the card.
 */
export interface PackReviewCard {
  readonly component: Component
  /** Whether the card has something for the rows in view, so the To review tab can say nothing waits when no card does. */
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

/** What the owner could take out of the company now, for Net worth, with the page that shows how it is made up, or why the pack cannot work it out. */
export type OwnerTakeOut =
  | {
      readonly kind: 'figure'
      readonly label: string
      readonly cents: Money
      /** What it is after, the owner's loan or the dividend tax, or why it is nothing. */
      readonly caption: string
      readonly to: RouteLocationRaw
    }
  | { readonly kind: 'missing'; readonly reason: string }

/** How the categories editor explains a class: its name, what Kuna counts with it, and where the rule behind it shows. */
export interface CategoryClassHelp {
  readonly name: string
  /** Such as "Kuna counts this as representation". */
  readonly sentence: string
  readonly link: { readonly label: string; readonly to: RouteLocationRaw }
}

/** What a pack adds to the core screens and figures. Its components are async, so the pack's code loads only with them. */
export interface PackContribution {
  /** The pack's part of the workbook, read whatever the owner-pay switch says. */
  readonly workbook: PackPart<unknown, unknown> | null
  /** Screens of the pack's own, listed after the core screens. The routes exist whatever the switch says, and their menu items show only while it is on, like the slots below. */
  readonly screens: readonly AppScreen[]
  /** Jobs for Overview's Waiting for you, listed after the core jobs. */
  waitingJobs(workbook: Workbook, asOf: CivilDate): readonly WaitingJob[]
  /** What the owner could take out on the newest booking. Null without a pack, which has no such figure. */
  ownerTakeOut(workbook: Workbook, asOf: CivilDate): OwnerTakeOut | null
  readonly reviewCards: readonly PackReviewCard[]
  /** Tabs of Settings, after Accounts. */
  readonly settingsTabs: readonly SettingsTab[]
  /** Cards on Settings, General, under the settings form. */
  readonly settingsCards: readonly Component[]
  readonly companyFacts: PackCompanyFacts<unknown> | null
  /** Where the spending breakdown links a cost group the pack breaks down further. */
  costGroupLinks(group: string): { readonly label: string; readonly to: RouteLocationRaw } | null
  /** The help for the class a role carries, with the law's figures in force on the day, or null for a role that carries none. */
  categoryClassHelp(role: string, on: CivilDate): CategoryClassHelp | null
  /**
   * The categories that do not count one way yet, each with what to change, with the law's figures in
   * force on the day. They are no reading problem: the figures still count each by its bucket and VAT.
   */
  categoriesToSort(categories: readonly Category[], on: CivilDate): readonly RecordProblem[]
  /** Kinds of mail the sync's mail step looks for after core's, in order. */
  readonly mailSources: readonly MailSource<Workbook>[]
  /** The Drive folders the pack's settings name, as paths, which a move of the books file has to respect. */
  folderSettings(workbook: Workbook): readonly (readonly string[])[]
  readonly onboarding: PackOnboarding | null
  /** The pack's assist tasks, for the Assistant tab after core's. */
  readonly assist: readonly AssistTaskSummary[]
  /** The IBANs on the employees' records, normalised, shared ones too, so a row paid to one can be kept from a model. */
  employeeIbans(records: WorkbookRecords): ReadonlySet<string>
  /** The employees' names from their records, so a row that names one can be kept from a model whatever its IBAN. */
  employeeNames(records: WorkbookRecords): readonly string[]
}

const NO_PACK: PackContribution = {
  workbook: null,
  screens: [],
  waitingJobs: () => [],
  ownerTakeOut: () => null,
  reviewCards: [],
  settingsTabs: [],
  settingsCards: [],
  companyFacts: null,
  costGroupLinks: () => null,
  categoryClassHelp: () => null,
  categoriesToSort: () => [],
  mailSources: [],
  folderSettings: () => [],
  onboarding: null,
  assist: [],
  employeeIbans: () => new Set(),
  employeeNames: () => [],
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
