import type { Component } from 'vue'
import type { RouteComponent, RouteLocationRaw, Router } from 'vue-router'

import type { RedirectReturn } from '../google/googleRedirect'
import type { MoneyFormat, MoneyTone, SignDisplay } from '../money/moneyFormat'
import type { AppData } from '../storage/application/appData'
import type { RecordKind } from '../storage/domain/recordKind'
import type { AppSyncGroup } from '../sync/presentation/pageSync'
import type { Money } from '../money/money'
import type { KnownPerson } from '../privacy/domain/pseudonyms'
import type { AppAcceptance, AppProposer, AssistantQuickAction } from './assistantOperations'
import type { AppReader } from './assistantReader'
import type { AttachedFile } from '../ai/domain/chatAttachments'

/** A screen of an app, on a route under the app's id such as `/company/transactions`. Each one loads as its own chunk. */
export interface AppScreen {
  readonly path: `/${string}`
  readonly title: string
  readonly icon: string
  readonly component: () => Promise<RouteComponent>
  /** Shown without the menu, as a first run is, and the browser tab says only Kuna. */
  readonly bare?: true
  /** Opens one record named in its address, such as one account, so no link can lead here without that record. */
  readonly needsRecord?: true
  /** The menu's screen this one opens from, such as an account's list, which the menu lights while this one shows. */
  readonly under?: `/${string}`
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
  readonly cents: Money
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
  readonly cents: Money
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

/** Where the app's assistant switch is, for its line in Kuna settings. */
export interface AppAssist {
  /** Where the app's own switches are, which Kuna settings links to, as the shell cannot know an app's tabs. */
  readonly settings: RouteLocationRaw
}

/** A part of a screen the chat can link to, such as a tab, with the address that opens it. */
export interface AssistantPlace {
  readonly route: `/${string}`
  readonly title: string
  /** The query keys a link may fill: a month, a year, a day, a period, or a ref of a record of a kind. */
  readonly params?: Readonly<Record<string, 'month' | 'year' | 'day' | 'period' | { readonly kind: string }>>
}

/** A settings key the app reads and what it means. Only ever the meaning, never the value a file holds. */
export interface AssistantSetting {
  readonly key: string
  readonly note: string
  /** The chat can never propose it, as it routes bank data or only a screen sets it. */
  readonly neverPropose?: true
}

/** A short how-to the chat can read, written in the language on screen, with the places it sends a person to. */
export interface AssistantGuide {
  readonly id: string
  readonly title: string
  readonly body: string
  readonly places: readonly `/${string}`[]
}

/** Something Kuna does on its own once it is set up, such as filing bank mail, and the place that sets it up. */
export interface AssistantAutomation {
  readonly id: string
  readonly title: string
  /** What it does for the person, in a sentence or two, written in the language on screen. */
  readonly what: string
  /** A screen or place of the app that sets it up, which the chat can link. */
  readonly setUpRoute: `/${string}`
  /** The id of one of the app's guides that walks through the set-up. */
  readonly guide?: string
}

/** What the app tells the chat about itself. All but `reader` is built from what the code declares and holds nothing from a person's books. */
export interface AppAssistant {
  readonly kinds: readonly RecordKind[]
  readonly places: readonly AssistantPlace[]
  readonly settings: readonly AssistantSetting[]
  readonly guides: readonly AssistantGuide[]
  readonly automations: readonly AssistantAutomation[]
  /** What the chat can read of the app once allowed, or null for an app it cannot read yet. */
  readonly reader: AppReader | null
  /** The changes the chat can propose, or null for an app that takes none yet. */
  readonly proposer: AppProposer | null
  /** Writes a checked proposal. Only the proposal card reaches it, and no tool does. */
  readonly acceptance: AppAcceptance | null
  /** One tap in an empty chat. */
  readonly quickActions: readonly AssistantQuickAction[]
  /** The people the app knows by name, read from its books at each call, whose names go under an alias while Anonymise is on. */
  persons(): readonly KnownPerson[]
  /** The file formats the app's own readers take, which the chat reads on the device and never sends. */
  readonly fileFormats: readonly AppFileFormat[]
}

/** A file format an app's own reader takes. A file in it stays on the device, and `operation` imports it by the attachment's id. */
export interface AppFileFormat {
  /** What the format is called, such as `IBKR Activity Flex report`. */
  readonly name: string
  readonly operation: string
  /** Whether the app's reader takes this file, read on this device. False for a file it cannot read. */
  recognises(file: AttachedFile): Promise<boolean>
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
  /** What waits on a screen, shown beside its menu item, or null when nothing waits. An app where nothing ever waits leaves it out. */
  menuCount?(screen: AppScreen): MenuCount | null
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
  /** What the app holds and how it goes, for the delete in the app's Settings and in Kuna settings. */
  readonly data: AppData
  /** The app's own specimens for the gallery, which only development and fake builds load. */
  readonly gallery?: () => Promise<Component>
  /** What the app's assistant may do, for an app that has one. */
  readonly assist?: AppAssist
  /** What the app tells the chat about itself, which loads only once a chat starts. */
  readonly assistant: () => Promise<AppAssistant>
  /** Whether the page should fetch its Google token on the way in, with no screen at Google. */
  asksGoogleOnOpen(): boolean
  /**
   * Starts what runs while the page is open, from the shell's setup. `googleReturn` is Google's
   * answer to a trip the app's own find or pick asked for, or null. Returns the function that stops it.
   */
  start(router: Router, googleReturn: RedirectReturn | null): () => void
}
