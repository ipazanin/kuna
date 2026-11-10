import { DEVICE_SETTING } from '../../shared/app/assistantOperations'
import type { AcceptResult, AppAcceptance, AppProposer, AssistantOperation, CheckedProposal, DoneWarning, ProposalGroup, ProposalStep, UndoResult } from '../../shared/app/assistantOperations'
import type { FilesHome, KunaStart } from '../../shared/app/kunaStart'
import { inputOf, NUMBER_OR_NULL } from '../../shared/app/operationInput'
import { StepRefused } from '../../shared/app/proposedWrites'
import { words as sharedWords } from '../../shared/app/words'
import { formatCount } from '../../shared/money/moneyFormat'
import type { SyncAsking } from '../../shared/sync/application/sync'
import type { LanguageChoice } from '../../shared/text/language'
import type { ThemeChoice } from '../../shared/theme/theme'
import { words as settingsWords } from '../settings/words'
import type { RoomEffect, SidebarChoice } from '../ui/sidebarLayout'
import { words as shellWords } from '../ui/words'
import { words } from './words'
import type { RecordNoun } from '../../shared/storage/domain/recordKind'

/** The settings this device keeps that the chat may change, each read and set the way Kuna settings and the home do, and the page's sync. */
export interface KunaDevice {
  theme(): ThemeChoice
  chooseTheme(choice: ThemeChoice): void
  language(): LanguageChoice
  /** Remembers the language and loads Kuna again in it. */
  chooseLanguage(choice: LanguageChoice): void
  autoSync(): boolean
  switchAutoSync(on: boolean): void
  /** The person's answer to which apps they use, or null before the home asked. */
  start(): KunaStart | null
  answerStart(start: KunaStart): void
  /** Takes the answer back, so the home and the next app set up ask again. */
  forgetStart(): void
  /** The installed apps, by id and name. */
  apps(): readonly { readonly id: string; readonly name: string }[]
  /** Whether some app keeps its file on Drive, so a sync has something to read. */
  syncs(): boolean
  /** Runs the page's sync as Sync on the top bar does, and resolves to what the person should know of the run, or null when every step went through. */
  syncNow(asking: SyncAsking): Promise<DoneWarning | null>
  /** The cards this device keeps folded, by id. */
  foldedCards(): readonly string[]
  foldCard(cardId: string, folded: boolean): void
  sidebar(): SidebarChoice
  chooseSidebar(choice: SidebarChoice): void
  /** What the room rule does right now to the sidebar if `choice` were chosen, or null when it draws as chosen. */
  roomEffect(choice: SidebarChoice): RoomEffect | null
  /** The widths in px the chat may take, and the one a reset gives back. */
  readonly chatWidths: { readonly least: number; readonly most: number; readonly reset: number }
  /** The chat's width in px as set on this device. */
  chatWidth(): number
  resizeChat(px: number): void
}

/** An app the person said they use, as a card counts it. */
const APP_IN_USE: RecordNoun = {
  en: { one: 'app in use', many: 'apps in use', article: 'an' },
  hr: { one: 'aplikacija u upotrebi', of: 'aplikacije u upotrebi', few: 'aplikacije u upotrebi', other: 'aplikacija u upotrebi', gender: 'feminine' },
}

const THEMES: readonly ThemeChoice[] = ['system', 'light', 'dark']
const LANGUAGES: readonly LanguageChoice[] = ['browser', 'en', 'hr']
const SIDEBARS: readonly SidebarChoice[] = ['expanded', 'icons', 'hidden']
const SWITCH = ['on', 'off'] as const
const ASKING: readonly SyncAsking[] = ['due', 'now']

/** One setting a card changes, with its value as read when the card was made and the value Accept sets. */
type DeviceChange =
  | { readonly setting: 'theme'; readonly before: ThemeChoice; readonly after: ThemeChoice }
  | { readonly setting: 'language'; readonly before: LanguageChoice; readonly after: LanguageChoice }
  | { readonly setting: 'autoSync'; readonly before: boolean; readonly after: boolean }
  | { readonly setting: 'start'; readonly before: KunaStart; readonly after: KunaStart; readonly added: readonly string[] }
  | { readonly setting: 'start'; readonly before: KunaStart; readonly after: null }
  | { readonly setting: 'folded'; readonly before: readonly string[]; readonly after: readonly string[] }
  | { readonly setting: 'sidebar'; readonly before: SidebarChoice; readonly after: SidebarChoice; readonly effect: RoomEffect | null }
  | { readonly setting: 'chatWidth'; readonly before: number; readonly after: number }

/** What a Kuna card holds for Accept, which only this file reads: settings to change, or a sync to run. */
type HeldChanges = { readonly kind: 'settings'; readonly changes: readonly DeviceChange[] } | { readonly kind: 'sync'; readonly asking: SyncAsking }

/** The changes the chat can propose on this device, and the page's sync. Nothing that guards what the chat sends or holds a key is among them. */
export function kunaOperations(device: KunaDevice): readonly AssistantOperation[] {
  const { least, most, reset } = device.chatWidths
  const apps = device.apps().map((app) => app.id)
  return [
    {
      name: 'set-theme',
      about: 'The look on this device. system follows the device as it changes.',
      input: inputOf({ theme: { type: 'string', enum: THEMES } }),
      refs: {},
      creates: null,
      alone: false,
      example: { theme: 'dark' },
    },
    {
      name: 'set-language',
      about: "The language on this device. browser follows the browser's first language. Kuna loads again once the person accepts, so it goes one to a card and has no Undo.",
      input: inputOf({ language: { type: 'string', enum: LANGUAGES } }),
      refs: {},
      creates: null,
      alone: true,
      example: { language: 'hr' },
    },
    {
      name: 'switch-auto-sync',
      about: 'Whether this device syncs as Kuna opens and when the person comes back after ten minutes. To sync now, propose sync-now.',
      input: inputOf({ auto: { type: 'string', enum: SWITCH } }),
      refs: {},
      creates: null,
      alone: false,
      example: { auto: 'off' },
    },
    {
      name: 'add-app',
      about: 'Adds an app to the ones the person said they use, so its card leaves Other apps on the home and offers Set up. Setting it up stays with the person.',
      input: inputOf({ app: { type: 'string', enum: apps } }),
      refs: {},
      creates: null,
      alone: false,
      example: { app: apps.at(-1) ?? '' },
    },
    {
      name: 'sync-now',
      about:
        "Syncs every app whose file is on Drive, as Sync on the top bar does: it reads each file, then runs each app's steps, such as Company's mail and statements, Investments' prices and Spending's banks. It reaches Google and the banks. banks due leaves a bank alone for six hours after any device asked it. banks now asks each linked bank at once as the person's own fetch, as Sync now on Spending's settings does, which costs a call to every bank and may be refused by a bank asked often, so take now only when the person asks for the latest rows. It goes on a card of its own and has no Undo, since each step's write keeps its own Undo on the sync list.",
      input: inputOf({ banks: { type: 'string', enum: ASKING } }),
      refs: {},
      creates: null,
      alone: true,
      example: { banks: 'due' },
    },
    {
      name: 'open-folded-cards',
      about: 'Opens every card the person folded on this device, on every screen. A card on the screen now opens the next time its screen shows. Undo folds them again.',
      input: inputOf({}),
      refs: {},
      creates: null,
      alone: false,
      example: {},
    },
    {
      name: 'set-sidebar-layout',
      about:
        'How the sidebar shows on this device. expanded shows page names beside the icons. icons shows only icons. hidden leaves the sidebar out and puts its menu behind a button on the top bar. A sidebar shows only in a window with room for it beside the page, and opening the chat never changes it. The card says when the choice waits for a wider window or moves the chat.',
      input: inputOf({ layout: { type: 'string', enum: SIDEBARS, description: 'expanded, icons or hidden.' } }),
      refs: {},
      creates: null,
      alone: false,
      example: { layout: 'icons' },
    },
    {
      name: 'set-chat-width',
      about: `The chat panel's width on this device, in px from ${least} to ${most}. null puts back the default of ${reset}.`,
      input: inputOf({ width: { ...NUMBER_OR_NULL, description: `Pixels from ${least} to ${most}, or null for the default.` } }),
      refs: {},
      creates: null,
      alone: false,
      example: { width: most },
    },
    {
      name: 'forget-files-home',
      about: 'Forgets where new files go and which apps the person said they use, as Ask me again on Kuna settings does, so the home and the next app set up on this device ask again.',
      input: inputOf({}),
      refs: {},
      creates: null,
      alone: false,
      example: {},
    },
  ]
}

function choiceOf<T extends string>(choices: readonly T[], value: unknown): T {
  const choice = choices.find((candidate) => candidate === value)
  if (choice === undefined) throw new StepRefused(`That is one of ${choices.join(', ')}.`)
  return choice
}

/** The change a step makes, from the device as it is now, with the apps an earlier step of the card added. */
function changeOf(device: KunaDevice, { operation, input }: ProposalStep, earlier: readonly DeviceChange[]): DeviceChange {
  switch (operation) {
    case 'set-theme':
      return { setting: 'theme', before: device.theme(), after: choiceOf(THEMES, input['theme']) }
    case 'set-language':
      return { setting: 'language', before: device.language(), after: choiceOf(LANGUAGES, input['language']) }
    case 'switch-auto-sync':
      return { setting: 'autoSync', before: device.autoSync(), after: choiceOf(SWITCH, input['auto']) === 'on' }
    case 'add-app': {
      const app = choiceOf(
        device.apps().map((candidate) => candidate.id),
        input['app'],
      )
      const start = device.start()
      if (start === null) throw new StepRefused(words.refused.noAnswer)
      const added = earlier.flatMap((change) => (isAdding(change) ? change.added : []))
      if (start.apps.includes(app) || added.includes(app)) throw new StepRefused(words.refused.inUse)
      return { setting: 'start', before: start, after: { ...start, apps: [...start.apps, ...added, app] }, added: [...added, app] }
    }
    case 'set-sidebar-layout': {
      const after = choiceOf(SIDEBARS, input['layout'])
      return { setting: 'sidebar', before: device.sidebar(), after, effect: device.roomEffect(after) }
    }
    case 'set-chat-width': {
      const asked = input['width']
      const { least, most, reset } = device.chatWidths
      if (asked !== null && (typeof asked !== 'number' || !Number.isFinite(asked) || asked < least || asked > most)) throw new StepRefused(words.refused.chatWidthRange(least, most))
      return { setting: 'chatWidth', before: device.chatWidth(), after: asked === null ? reset : Math.round(asked) }
    }
    case 'forget-files-home': {
      const start = device.start()
      if (start === null) throw new StepRefused(words.refused.notAnswered)
      return { setting: 'start', before: start, after: null }
    }
    case 'open-folded-cards': {
      const folded = device.foldedCards()
      if (folded.length === 0) throw new StepRefused(words.refused.noneFolded)
      return { setting: 'folded', before: folded, after: [] }
    }
    default:
      throw new StepRefused('There is no such operation.')
  }
}

/** The card's changes, one to each setting, with the apps added folded into one answer. Forgetting the answer goes with no other change to it. */
function changesOf(device: KunaDevice, steps: readonly ProposalStep[]): readonly DeviceChange[] {
  const changes: DeviceChange[] = []
  for (const step of steps) {
    const change = changeOf(device, step, changes)
    const at = changes.findIndex((held) => held.setting === change.setting)
    if (at === -1) changes.push(change)
    else if (isAdding(change) && isAdding(changes[at]!)) changes[at] = change
    else throw new StepRefused(words.refused.twice)
  }
  return changes
}

/** A change that adds apps to the answer, rather than forgetting it. */
function isAdding(change: DeviceChange): change is Extract<DeviceChange, { readonly added: readonly string[] }> {
  return change.setting === 'start' && change.after !== null
}

function themeName(choice: ThemeChoice): string {
  return settingsWords.appearance[choice]
}

/** Each language named in itself, as Kuna settings names it. */
function languageName(choice: LanguageChoice): string {
  return choice === 'browser' ? settingsWords.language.browser : choice === 'en' ? 'English' : 'Hrvatski'
}

function sidebarName(choice: SidebarChoice): string {
  return shellWords.sidebarLayout[choice]
}

function homeName(home: FilesHome): string {
  return home === 'drive' ? words.home.drive : words.home.browser
}

function switchName(on: boolean): string {
  return on ? words.on : words.off
}

/** What the card shows: the settings of this device on one line, then each app added. */
function groupsOf(device: KunaDevice, changes: readonly DeviceChange[]): readonly ProposalGroup[] {
  const fields = changes.flatMap((change) => {
    switch (change.setting) {
      case 'theme':
        return [{ name: settingsWords.appearance.theme, before: themeName(change.before), after: themeName(change.after), warns: false }]
      case 'language':
        return [{ name: settingsWords.language.legend, before: languageName(change.before), after: languageName(change.after), warns: false }]
      case 'autoSync':
        return [{ name: settingsWords.sync.auto, before: switchName(change.before), after: switchName(change.after), warns: false }]
      case 'start':
        return change.after === null ? [{ name: settingsWords.filesHome.title, before: homeName(change.before.home), after: words.home.askAgain, warns: false }] : []
      case 'folded':
        return [{ name: words.foldedCards, before: formatCount(change.before.length), after: formatCount(change.after.length), warns: false }]
      case 'sidebar':
        return [{ name: shellWords.sidebarLayout.name, before: sidebarName(change.before), after: sidebarName(change.after), warns: false }]
      case 'chatWidth':
        return [{ name: shellWords.chatWidth, before: `${change.before} px`, after: `${change.after} px`, warns: false }]
    }
  })
  const added = changes.flatMap((change) => (isAdding(change) ? change.added.map((id) => ({ label: device.apps().find((app) => app.id === id)?.name ?? id, fields: [], warning: null })) : []))
  const notes = changes.flatMap((change) =>
    change.setting === 'sidebar' && change.effect !== null ? [{ label: shellWords.sidebarLayout.name, text: shellWords.sidebarLayout.effects[change.effect], tone: 'neutral' as const }] : [],
  )
  return [
    ...(fields.length === 0 ? [] : [{ verb: 'change' as const, noun: DEVICE_SETTING, notes, lines: [{ label: words.thisDevice, fields, warning: null }] }]),
    ...(added.length === 0 ? [] : [{ verb: 'add' as const, noun: APP_IN_USE, notes: [], lines: added }]),
  ]
}

function valueOf(device: KunaDevice, setting: DeviceChange['setting']): unknown {
  switch (setting) {
    case 'theme':
      return device.theme()
    case 'language':
      return device.language()
    case 'autoSync':
      return device.autoSync()
    case 'start':
      return device.start()
    case 'folded':
      return device.foldedCards()
    case 'sidebar':
      return device.sidebar()
    case 'chatWidth':
      return device.chatWidth()
  }
}

function sameValue(held: unknown, now: unknown): boolean {
  return JSON.stringify(held) === JSON.stringify(now)
}

function set(device: KunaDevice, change: DeviceChange, to: 'before' | 'after'): void {
  switch (change.setting) {
    case 'theme':
      device.chooseTheme(change[to])
      return
    case 'language':
      device.chooseLanguage(change[to])
      return
    case 'autoSync':
      device.switchAutoSync(change[to])
      return
    case 'start': {
      const start = change[to]
      if (start === null) device.forgetStart()
      else device.answerStart(start)
      return
    }
    case 'folded':
      change.before.forEach((cardId) => device.foldCard(cardId, to === 'before'))
      return
    case 'sidebar':
      device.chooseSidebar(change[to])
      return
    case 'chatWidth':
      device.resizeChat(change[to])
      return
  }
}

/** A sync goes on a card of its own, and only while some app keeps its file on Drive. */
function syncCheck(device: KunaDevice, title: string, steps: readonly ProposalStep[]): CheckedProposal | { readonly refused: readonly string[] } {
  if (steps.length > 1) return { refused: [words.refused.syncAlone] }
  if (!device.syncs()) return { refused: [words.refused.nothingOnDrive] }
  let asking: SyncAsking
  try {
    asking = choiceOf(ASKING, steps[0]!.input['banks'])
  } catch (failure) {
    if (failure instanceof StepRefused) return { refused: [failure.message] }
    throw failure
  }
  const held: HeldChanges = { kind: 'sync', asking }
  return { title, count: 1, groups: [], outside: [asking === 'now' ? words.outside.syncsBanksNow : words.outside.syncs], undoable: false, heldBack: null, held }
}

/** The settings of this device the chat may change, and the page's sync. They hold nothing of the books, so a check reads none. */
export function kunaProposer(device: KunaDevice): AppProposer {
  return {
    operations: kunaOperations(device),
    readsBooks: false,
    check(title, steps) {
      if (steps.some((step) => step.operation === 'sync-now')) return Promise.resolve(syncCheck(device, title, steps))
      let changes: readonly DeviceChange[]
      try {
        changes = changesOf(device, steps)
      } catch (failure) {
        if (failure instanceof StepRefused) return Promise.resolve({ refused: [failure.message] })
        throw failure
      }
      if (changes.some((change) => sameValue(change.before, change.after))) return Promise.resolve({ refused: [words.refused.same] })
      const reloads = changes.some((change) => change.setting === 'language')
      const held: HeldChanges = { kind: 'settings', changes }
      const proposal: CheckedProposal = { title, count: steps.length, groups: groupsOf(device, changes), outside: reloads ? [words.outside.reloads] : [], undoable: !reloads, heldBack: null, held }
      return Promise.resolve(proposal)
    },
  }
}

/**
 * Sets what the card shows, refused when a setting was changed since. Undo puts back each value while it is still the one the card set.
 * A sync runs inside the person's click, so Google's consent can open, and says what needs the person.
 */
export function kunaAcceptance(device: KunaDevice): AppAcceptance {
  return {
    async accept(proposal): Promise<AcceptResult> {
      const held = proposal.held as HeldChanges
      if (held.kind === 'sync') {
        const warning = await device.syncNow(held.asking)
        return warning === null ? { kind: 'done', undo: null } : { kind: 'done', undo: null, warning }
      }
      const { changes } = held
      if (changes.some((change) => !sameValue(change.before, valueOf(device, change.setting)))) return { kind: 'refused', reason: words.refused.changedSince }
      changes.forEach((change) => set(device, change, 'after'))
      const undo = (): Promise<UndoResult> => {
        if (changes.some((change) => !sameValue(change.after, valueOf(device, change.setting)))) return Promise.resolve({ kind: 'refused', reason: sharedWords.proposalUndoEnded })
        for (const change of [...changes].reverse()) set(device, change, 'before')
        return Promise.resolve({ kind: 'undone' })
      }
      return { kind: 'done', undo: proposal.undoable ? undo : null }
    },
  }
}
