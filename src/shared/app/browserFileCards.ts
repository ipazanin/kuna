import type { BooksRead, WorkbookStore } from '../storage/application/createWorkbookStore'
import type { WorkbookCopy } from '../storage/application/workbookPorts'
import type { AppAcceptance, AppProposer, AssistantOperation, CheckedProposal, ProposalStep } from './assistantOperations'
import { MAKE_FILE, REMOVE_FILE, heldFileStep } from './browserFileStep'
import type { HeldFileStep } from './browserFileStep'
import { isFirstRun } from './isFirstRun'
import { answerFromFirstRun, kunaStart } from './kunaStart'
import { inputOf } from './operationInput'
import { words } from './words'

/** The file each app's `make-file` made while this page is open, by the app's id, as each chat builds the app's changes anew. */
const madeOnThisPage = new Map<string, string>()

/** The app's file kept in this browser, made from the chat as the first run's Continue makes it, and removed again. */
export interface BrowserFile {
  readonly appName: string
  /** True while the app has no file on this device. */
  hasNoFile(): boolean
  /** Whether the file on screen is the one `make` made while this page is open. */
  madeHere(): boolean
  /** Makes the file and chooses it, and resolves to why it failed, or null. */
  make(): Promise<string | null>
  /** Deletes the file `make` made, and resolves to whether it went. */
  remove(): Promise<boolean>
}

/** What a new file of the app holds and the title it is kept under. */
export interface NewBrowserFile<Contents> {
  readonly contents: Contents
  readonly title: string
}

/** The app's browser file over its store, as its first run makes one. The person's answer counts as the one answer, so the next app does not ask again. */
export function browserFileOf<Contents>(
  store: Pick<WorkbookStore<BooksRead, WorkbookCopy, Contents>, 'state' | 'replaceLocalWorkbook' | 'dropWorkbook'>,
  app: { readonly id: string; readonly name: string },
  newFile: () => NewBrowserFile<Contents>,
): BrowserFile {
  const madeHere = (): boolean => store.state.choice?.source === 'browser' && store.state.choice.id === madeOnThisPage.get(app.id)
  return {
    appName: app.name,
    hasNoFile: () => isFirstRun(store.state),
    madeHere,
    async make() {
      const { contents, title } = newFile()
      answerFromFirstRun('browser', app.id, false)
      await store.replaceLocalWorkbook(contents, title)
      if (store.state.status === 'error') return store.state.error ?? words.fileNotMade
      const chosen = store.state.choice?.id
      if (chosen !== undefined) madeOnThisPage.set(app.id, chosen)
      return null
    },
    async remove() {
      const made = madeOnThisPage.get(app.id)
      if (!madeHere() || made === undefined) return false
      const removed = await store.dropWorkbook(made)
      if (removed) madeOnThisPage.delete(app.id)
      return removed
    },
  }
}

const OPERATIONS: readonly AssistantOperation[] = [
  {
    name: MAKE_FILE,
    about:
      "Makes the app's file in this browser, as its first run does, for an app with no file on this device. Only for a person who said they keep their files in this browser. A file on Drive needs Google's own step, and a person who has not said where their files live answers on the start screen, so link that screen instead. It goes alone on a card and has no Undo. remove-file takes the file away again.",
    input: inputOf({}),
    refs: {},
    creates: null,
    alone: true,
    example: {},
  },
  {
    name: REMOVE_FILE,
    about: 'Deletes the file make-file made in this browser while this page is open, with all it holds, so the app starts with no file again. It goes alone on a card and has no Undo.',
    input: inputOf({}),
    refs: {},
    creates: null,
    alone: true,
    example: {},
  },
]

function isFileStep(step: ProposalStep): boolean {
  return step.operation === MAKE_FILE || step.operation === REMOVE_FILE
}

function refusedFileStep(steps: readonly ProposalStep[], file: BrowserFile): string | null {
  if (steps.length > 1) return 'A file card goes alone.'
  if (steps[0]!.operation === REMOVE_FILE) return file.madeHere() ? null : 'Only the file make-file made while this page is open can be removed. Any other goes on the app’s Settings.'
  if (!file.hasNoFile()) return `${file.appName} has a file on this device already.`
  const home = kunaStart()?.home
  if (home === 'drive') return `The person keeps their files on Drive, so the ${file.appName} file is made on its start screen, with Google's own step. Link that screen.`
  if (home !== 'browser') return `The person has not said where they keep their files, so the ${file.appName} file is made on its start screen. Link that screen.`
  return null
}

function checkedFileStep(title: string, step: HeldFileStep, file: BrowserFile): CheckedProposal {
  const making = step.browserFile === MAKE_FILE
  return {
    title,
    count: 1,
    groups: [],
    outside: making ? [words.fileMade(file.appName), words.fileRemovedAgain] : [words.fileRemoved(file.appName)],
    undoable: false,
    heldBack: null,
    held: step,
  }
}

/** The app's changes with its file cards beside them: making its file in this browser, and removing that file again. */
export function withBrowserFileCards(proposer: AppProposer, file: BrowserFile): AppProposer {
  return {
    operations: [...proposer.operations, ...OPERATIONS],
    readsBooks: proposer.readsBooks,
    check(title, steps) {
      if (!steps.some(isFileStep)) return proposer.check(title, steps)
      const refused = refusedFileStep(steps, file)
      if (refused !== null) return Promise.resolve({ refused: [refused] })
      return Promise.resolve(checkedFileStep(title, { browserFile: steps[0]!.operation === MAKE_FILE ? MAKE_FILE : REMOVE_FILE }, file))
    },
  }
}

/** Writes a file card, or hands any other card to the app. */
export function acceptingBrowserFileCards({ accept: acceptOther }: AppAcceptance, file: BrowserFile): AppAcceptance {
  return {
    async accept(proposal) {
      const step = heldFileStep(proposal)
      if (step === null) return acceptOther(proposal)
      if (step.browserFile === REMOVE_FILE) return (await file.remove()) ? { kind: 'done', undo: null } : { kind: 'refused', reason: words.fileNotRemoved }
      if (!file.hasNoFile()) return { kind: 'refused', reason: words.fileThereAlready(file.appName) }
      const failure = await file.make()
      return failure === null ? { kind: 'done', undo: null } : { kind: 'refused', reason: failure }
    },
  }
}
