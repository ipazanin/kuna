import type { AcceptResult, CheckedProposal, ProposalGroup, ProposalStep, UndoResult } from './assistantOperations'
import { words } from './words'
import { canUndo } from '../storage/application/createWorkbookStore'
import type { BooksRead, WorkbookStore, WriteCheck } from '../storage/application/createWorkbookStore'
import { changesOf, isUndoable, workOf } from '../storage/application/recordWrites'
import type { CheckedWrite, RuledChange } from '../storage/application/recordWrites'
import type { RecordChange } from '../storage/application/recordStorage'
import type { UnitOfWork } from '../storage/application/repository'
import { WorkbookWriteRefused } from '../storage/application/workbookWriteRefused'
import { sameRecord } from '../storage/domain/recordsRead'

/** Says why a step cannot be planned, in words the model can act on. */
export class StepRefused extends Error {}

/** The most changes a card may hold. Larger ones go as several cards, so a person can still read them. */
const MOST_CHANGES = 200

/** The books on screen, once the app's file is open. */
export interface OpenBooks<Books extends BooksRead> {
  readonly workbook: NonNullable<Books['workbook']>
  readonly records: NonNullable<Books['records']>
}

/** How an app turns the chat's steps into one write of its books, and what that write leaves outside them. */
export interface ProposalWork<Books extends BooksRead, Kept> {
  /** The refusal the model hears while the app's file is not open on this device. */
  readonly notOpen: string
  /**
   * Plans the steps into one write through the screens' own write functions, throwing `StepRefused` for a step that cannot go.
   * `kept` is what `beforeWrite` gave, and undefined in the check, which runs before it.
   */
  plan(unit: UnitOfWork, books: OpenBooks<Books>, steps: readonly ProposalStep[], kept: Kept | undefined): void
  /** What the card shows of the checked write. */
  groups(checked: CheckedWrite, books: OpenBooks<Books>): readonly ProposalGroup[]
  /**
   * Keeps a file the write points to, such as a receipt photo in Kuna's receipts folder, with access the person already gave.
   * It runs on Accept after the card is found current and before the records write. It throws, in the person's words, when access is missing.
   */
  beforeWrite?(steps: readonly ProposalStep[]): Promise<Kept>
  /** What Accept leaves outside the books, which Undo does not take back, each a line on the card. */
  outside?(steps: readonly ProposalStep[]): readonly string[]
  /** What the model should do with steps that make more changes than a card holds, when proposing fewer is no way out, or null for that. */
  overLimit?(steps: readonly ProposalStep[]): string | null
}

/** What a proposal holds for Accept, which only this file reads: the checked changes, and the books and steps they were planned from. */
interface HeldWrite<Books extends BooksRead> {
  readonly title: string
  readonly changes: readonly RuledChange[]
  readonly books: OpenBooks<Books>
  readonly steps: readonly ProposalStep[]
}

type Refused = { readonly kind: 'refused'; readonly reason: string }

function refusedBy(failure: unknown): Refused {
  if (failure instanceof WorkbookWriteRefused) return { kind: 'refused', reason: failure.message }
  throw failure
}

/** The record as read that a change starts from, or null for an add, a repair or a discard. */
function readRecord(change: RecordChange): unknown {
  return 'before' in change ? change.before : null
}

/** Whether a plan touches the records the card showed: the same verbs and kinds in the same order, each from the same record as read. */
function touchesSameRecords(planned: readonly RuledChange[], shown: readonly RuledChange[]): boolean {
  const altering = planned.filter(({ change }) => change.verb !== 'change' || !sameRecord(change.before, change.after))
  return (
    altering.length === shown.length &&
    altering.every(({ change }, at) => {
      const held = shown[at]!.change
      return change.verb === held.verb && change.kind.name === held.kind.name && sameRecord(readRecord(change), readRecord(held))
    })
  )
}

/**
 * An app's dry run of the chat's steps over its own store, and the one write with one Undo that Accept makes of it.
 * The write holds the changes as they were checked, so a record changed since is refused rather than overwritten, and the file's other writes go on.
 * With `beforeWrite`, the steps are planned again with what it kept, and that plan must touch the records the card showed.
 */
export function proposedWrites<Books extends BooksRead, Kept = never>(
  store: Pick<WorkbookStore<Books>, 'state' | 'check' | 'write' | 'undo'>,
  work: ProposalWork<Books, Kept>,
): {
  check(title: string, steps: readonly ProposalStep[]): Promise<CheckedProposal | { readonly refused: readonly string[] }>
  accept(proposal: CheckedProposal): Promise<AcceptResult>
} {
  /** The changes Accept writes: the checked ones, or with `beforeWrite` the same records planned again with what it kept. */
  async function writtenChanges({ title, changes, books, steps }: HeldWrite<Books>): Promise<readonly RuledChange[] | Refused> {
    if (work.beforeWrite === undefined) return changes
    const current = await store.check(title, workOf(changes))
    if (current.status === 'refused') return { kind: 'refused', reason: current.reason }
    let kept: Kept
    try {
      kept = await work.beforeWrite(steps)
    } catch (failure) {
      return { kind: 'refused', reason: failure instanceof Error ? failure.message : String(failure) }
    }
    let planned: readonly RuledChange[]
    try {
      planned = changesOf((unit) => work.plan(unit, books, steps, kept))
    } catch (failure) {
      if (failure instanceof StepRefused) return { kind: 'refused', reason: failure.message }
      throw failure
    }
    return touchesSameRecords(planned, changes) ? planned : { kind: 'refused', reason: words.proposalChangedOnAccept }
  }

  return {
    async check(title, steps) {
      const { workbook, records } = store.state
      if (workbook === null || workbook === undefined || records === null || records === undefined) return { refused: [work.notOpen] }
      const books: OpenBooks<Books> = { workbook, records }
      let check: WriteCheck
      try {
        check = await store.check(title, (unit) => work.plan(unit, books, steps, undefined))
      } catch (failure) {
        if (failure instanceof StepRefused) return { refused: [failure.message] }
        throw failure
      }
      if (check.status === 'refused') return { refused: [check.reason] }
      if (check.status === 'nothingToChange') return { refused: ['Nothing would change.'] }
      const { checked } = check
      if (checked.changes.length > MOST_CHANGES) {
        return { refused: [`That is ${checked.changes.length} changes. A card holds ${MOST_CHANGES}.`, work.overLimit?.(steps) ?? 'Propose fewer, and then the rest.'] }
      }
      const held: HeldWrite<Books> = { title, changes: checked.changes, books, steps }
      return { title, count: checked.changes.length, groups: work.groups(checked, books), outside: work.outside?.(steps) ?? [], undoable: isUndoable(checked.changes), held }
    },

    async accept(proposal) {
      const held = proposal.held as HeldWrite<Books>
      const written = await writtenChanges(held)
      if ('kind' in written) return written
      try {
        const receipt = await store.write(held.title, workOf(written))
        const undo = async (): Promise<UndoResult> => {
          const write = store.state.writes.find((candidate) => candidate.receipt === receipt)
          if (write === undefined || !canUndo(write, store.state.writes)) return { kind: 'refused', reason: words.proposalUndoEnded }
          try {
            await store.undo(write)
            return { kind: 'undone' }
          } catch (failure) {
            return refusedBy(failure)
          }
        }
        return { kind: 'done', undo: isUndoable(written) ? undo : null }
      } catch (failure) {
        return refusedBy(failure)
      }
    },
  }
}
