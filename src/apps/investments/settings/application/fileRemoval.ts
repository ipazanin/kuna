import { words as storageWords } from '../../../../shared/storage/application/words'
import type { WorkbookChoice } from '../../../../shared/storage/application/workbookPorts'
import { WorkbookWriteRefused } from '../../../../shared/storage/application/workbookWriteRefused'

/**
 * The steps of a removal, in the order they run: the prices file beside the Investments file, the Investments file
 * itself, then the prices this browser keeps of it. A file kept in this browser has only the last two.
 */
export type RemovalStep = 'prices-file' | 'file' | 'prices-copy'

export type RemovalOutcome = { readonly kind: 'done' } | { readonly kind: 'failed'; readonly message: string } | { readonly kind: 'not-run' }

export interface RemovalReport {
  /** Each step of the file's removal with what came of it, in order. */
  readonly steps: readonly { readonly step: RemovalStep; readonly outcome: RemovalOutcome }[]
  /** Whether this browser forgot the file, which lands it on the Investments first run. */
  readonly removed: boolean
}

export interface FileRemovalPorts {
  /** Moves every prices file beside the Investments file on Drive to the bin. */
  trashPricesFiles(investmentsFileId: string): Promise<void>
  /**
   * Moves the Investments file on Drive to the bin, or deletes the one kept in this browser, and forgets it, running
   * `first` before that while no sync or write starts. `first` starts in the same turn as the file is taken, before any
   * await. Throws what `first` throws, with nothing dropped. Resolves to null once the file is forgotten, or to why it is not.
   */
  dropFile(investmentsFileId: string, first: () => Promise<void>): Promise<string | null>
  /** Deletes the prices this browser keeps of the Investments file. */
  forgetPricesCopy(investmentsFileId: string): Promise<void>
  /** Runs `work` while no price fetch or read starts, once one under way is over. */
  withoutPrices<Result>(work: () => Promise<Result>): Promise<Result>
  /** Resolves once no sync of the page is under way. */
  syncsOver(): Promise<void>
  /** Whether a sync of the page is under way, one still waiting for a save among them. */
  syncing(): boolean
}

function messageOf(failure: unknown): string {
  return failure instanceof Error ? failure.message : String(failure)
}

/**
 * Removes the Investments file this browser shows, once a sync under way is over. On Drive the prices files go first,
 * and a failure there stops the removal, so the Investments file stays chosen and readable and Remove can run again. The
 * Investments file goes after them, since forgetting it also forgets the id that finds them. The prices this browser
 * keeps go last, once nothing reads them. The keys stay, since they belong to the Google account. Each step's outcome
 * is reported.
 */
export async function removeInvestmentsFile(ports: FileRemovalPorts, choice: WorkbookChoice): Promise<RemovalReport> {
  const order: readonly RemovalStep[] = choice.source === 'drive' ? ['prices-file', 'file', 'prices-copy'] : ['file', 'prices-copy']
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

  return ports.withoutPrices(async () => {
    await ports.syncsOver()
    let refusal: string | null
    try {
      refusal = await ports.dropFile(choice.id, async () => {
        // A sync that started since would read the file being removed, and its Prices step could make its prices file again.
        if (ports.syncing()) {
          throw new WorkbookWriteRefused(storageWords.busy)
        }
        if (choice.source === 'drive') {
          await run('prices-file', () => ports.trashPricesFiles(choice.id))
        }
      })
    } catch (failure) {
      // A refusal before the first step, such as a sync under way, belongs to the file's own step.
      if (![...outcomes.values()].some((outcome) => outcome.kind === 'failed')) {
        outcomes.set('file', { kind: 'failed', message: messageOf(failure) })
      }
      return report(false)
    }
    if (refusal !== null) {
      outcomes.set('file', { kind: 'failed', message: refusal })
      return report(false)
    }
    outcomes.set('file', { kind: 'done' })
    try {
      await run('prices-copy', () => ports.forgetPricesCopy(choice.id))
    } catch {
      // The report names it, and the file is forgotten all the same.
    }
    return report(true)
  })
}
