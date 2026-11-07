import type { DropOptions } from './createWorkbookStore'
import { words } from './words'
import type { WorkbookChoice } from './workbookPorts'
import { WorkbookWriteRefused } from './workbookWriteRefused'

/** Where an app's data can be deleted from: its file on Drive, and the copy in this browser, which is the file itself for one kept here. */
export type DataPlace = 'drive-file' | 'browser-copy'

/** What the app really has in the storage selected. A file on Drive already in the bin or gone offers only the copy. */
export function placesHeld(choice: WorkbookChoice | null, missing: boolean): readonly DataPlace[] {
  if (choice === null) return []
  return choice.source === 'drive' && !missing ? ['drive-file', 'browser-copy'] : ['browser-copy']
}

/** The choice with a place ticked or unticked. The copy goes with the Drive file, since a copy of a file in the bin can no longer be saved. */
export function withPlace(chosen: readonly DataPlace[], place: DataPlace, on: boolean): readonly DataPlace[] {
  if (place === 'drive-file') return on ? ['drive-file', 'browser-copy'] : ['browser-copy']
  if (chosen.includes('drive-file')) return chosen
  return on ? ['browser-copy'] : []
}

/** The steps of a removal, in the order they can run. `backups` goes first, since forgetting the file also forgets the id that finds them. `browser-file` is a file kept only here, and `browser-copy` the copy of a file that stays on Drive. */
export type RemovalStep = 'backups' | 'beside-file' | 'drive-file' | 'browser-file' | 'browser-copy' | 'beside-copy'

export type RemovalOutcome = { readonly kind: 'done' } | { readonly kind: 'failed'; readonly message: string } | { readonly kind: 'not-run' }

export interface RemovalReport {
  /** Each step with what came of it, in order. */
  readonly steps: readonly { readonly step: RemovalStep; readonly outcome: RemovalOutcome }[]
  /** Whether this browser forgot the file, which lands it on the app's first run. */
  readonly removed: boolean
}

/** What an app keeps beside its file, which goes when the file goes. */
export interface DataBeside {
  /** The name of the file beside it on Drive. */
  readonly fileName: string
  /** Moves every such file beside the app's file to the bin. */
  trashFiles(fileId: string): Promise<void>
  /** Deletes what this browser keeps of them. */
  forgetCopy(fileId: string): Promise<void>
  /** Runs `work` while nothing starts that would read or make them, once what is under way is over. */
  whileStopped<Result>(work: () => Promise<Result>): Promise<Result>
}

export interface DataRemovalPorts {
  /** As `WorkbookStore.dropWorkbook` says. `first` starts in the same turn as the file is taken, before any await. */
  dropFile(fileId: string, options: DropOptions): Promise<boolean>
  /** As `WorkbookStore.trashBackups` says. */
  trashBackups(fileId: string): Promise<void>
  /** Resolves once no sync of the page is under way. */
  syncsOver(): Promise<void>
  /** Whether a sync of the page is under way, one still waiting for a save among them. */
  syncing(): boolean
  readonly beside: DataBeside | null
  /** Forgets what this device kept about the app and its file apart from the file, such as answers and switches. */
  forgetOnThisDevice(fileId: string): void
}

function messageOf(failure: unknown): string {
  return failure instanceof Error ? failure.message : String(failure)
}

/**
 * Removes what was chosen of the file this browser shows, once a sync under way is over. The backups and a Drive file's neighbours go first, and a failure
 * there stops the removal, so the file stays chosen and readable and it can run again. The file goes after them, since forgetting it also forgets the id
 * that finds them. What this browser keeps beside it goes last, once nothing reads it. Each step's outcome is reported.
 */
export async function removeAppData(ports: DataRemovalPorts, choice: WorkbookChoice, places: readonly DataPlace[], withBackups = false): Promise<RemovalReport> {
  const binningBackups = withBackups && choice.source === 'drive'
  const dropping = places.length > 0
  if (!dropping && !binningBackups) return { steps: [], removed: false }
  const trashing = places.includes('drive-file')
  const fileStep: RemovalStep = choice.source === 'browser' ? 'browser-file' : trashing ? 'drive-file' : 'browser-copy'
  const { beside } = ports
  const order: readonly RemovalStep[] = [
    ...(binningBackups ? (['backups'] as const) : []),
    ...(beside !== null && trashing ? (['beside-file'] as const) : []),
    ...(dropping ? [fileStep] : []),
    ...(beside !== null && dropping ? (['beside-copy'] as const) : []),
  ]
  const outcomes = new Map<RemovalStep, RemovalOutcome>(order.map((step) => [step, { kind: 'not-run' }]))
  const report = (removed: boolean): RemovalReport => ({ steps: order.map((step) => ({ step, outcome: outcomes.get(step)! })), removed })

  async function run(step: RemovalStep, work: () => Promise<void>): Promise<void> {
    try {
      await work()
      outcomes.set(step, { kind: 'done' })
    } catch (failure) {
      outcomes.set(step, { kind: 'failed', message: messageOf(failure) })
      throw failure
    }
  }

  async function removal(): Promise<RemovalReport> {
    await ports.syncsOver()
    try {
      if (binningBackups) {
        await run('backups', async () => {
          if (ports.syncing()) throw new WorkbookWriteRefused(words.busy)
          await ports.trashBackups(choice.id)
        })
      }
      if (!dropping) return report(false)
      const dropped = await ports.dropFile(choice.id, {
        keepDriveFile: !trashing,
        first: async () => {
          // A sync that started since would read the file being removed, and a step of it could make a neighbour again.
          if (ports.syncing()) throw new WorkbookWriteRefused(words.busy)
          if (beside !== null && trashing) await run('beside-file', () => beside.trashFiles(choice.id))
        },
      })
      if (!dropped) throw new WorkbookWriteRefused(words.noBooks)
    } catch (failure) {
      // A failed step before the file has its own line already, and anything else belongs to the file's step.
      if (![...outcomes.values()].some((outcome) => outcome.kind === 'failed')) {
        outcomes.set(fileStep, { kind: 'failed', message: messageOf(failure) })
      }
      return report(false)
    }
    outcomes.set(fileStep, { kind: 'done' })
    ports.forgetOnThisDevice(choice.id)
    if (beside !== null) {
      try {
        await run('beside-copy', () => beside.forgetCopy(choice.id))
      } catch {
        // The report names it, and the file is forgotten all the same.
      }
    }
    return report(true)
  }

  return beside === null ? removal() : beside.whileStopped(removal)
}

/** Whether every step ran and went, so nothing is left to say. */
export function removalWent(report: RemovalReport): boolean {
  return report.steps.every(({ outcome }) => outcome.kind === 'done')
}

/** What an app holds now, for the delete dialog to offer. */
export interface HeldData {
  readonly source: WorkbookChoice['source']
  readonly fileName: string
  readonly places: readonly DataPlace[]
  /** The name of the file that goes beside a Drive file, or null. */
  readonly besideFileName: string | null
  /** Whether a copy is on screen to download. */
  readonly canBackUp: boolean
  /** Whether a write of the file is queued, so a delete would be refused. */
  readonly busy: boolean
}

/** What an app gives the delete dialogs. The shell sees an app's data only through this. */
export interface AppData {
  readonly id: string
  readonly name: string
  /** Null while the app has no file on this device. */
  held(): HeldData | null
  /** Downloads the export the app already has, and gives the file's name. */
  backUp(): Promise<string>
  /** How many backups Kuna made of the file are on Drive, or null for a file kept in this browser or when that is not known without a sign-in. */
  backupsOnDrive(): Promise<number | null>
  /** Removes what was chosen, as `removeAppData` says. Ask Google for `drive.file` first when the Drive file or the backups are among it. */
  remove(places: readonly DataPlace[], withBackups?: boolean): Promise<RemovalReport>
}
