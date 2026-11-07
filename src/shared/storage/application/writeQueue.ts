import type { RecordChange } from './recordStorage'
import type { RuledChange, WriteReceipt } from './recordWrites'
import { WorkbookWriteRefused } from './workbookWriteRefused'

/** How a caller asks for a write to go through the file's queue. */
export interface WriteOptions {
  /** Names the control that started the write, so it can spin while the write waits or runs. */
  readonly key?: string
  /** For a one-tap control whose value is on it. The screen shows the change from the tap, and without it from when the write lands. */
  readonly shownAtOnce?: boolean
}

/** A write waiting its turn on the file, or running. */
export interface QueuedWrite {
  /** Counts up from 1 in the order the writes were asked for. */
  readonly id: number
  readonly title: string
  /** What names it to `saving(key)`: the control that started it, and for an undo the undo and the control of the write it undoes. */
  readonly keys: readonly string[]
  readonly shownAtOnce: boolean
  /** The workbook on screen when it was asked for. Its turn refuses it on any other. */
  readonly workbookId: string
  readonly changes: readonly RuledChange[]
  /** The receipt of the write this one undoes, or null. */
  readonly undid: WriteReceipt | null
}

/**
 * What the screen shows of a copy: the copy with the queued changes marked shown at once made on top of it, in queue order.
 * A write that no longer applies stays off the screen, and its turn refuses it.
 */
export function shownCopyOf<Copy>(copy: Copy, queue: readonly QueuedWrite[], withChanges: (copy: Copy, changes: readonly RecordChange[]) => Copy): Copy {
  let shown = copy
  for (const queued of queue) {
    if (!queued.shownAtOnce) continue
    try {
      shown = withChanges(
        shown,
        queued.changes.map(({ change }) => change),
      )
    } catch (failure) {
      if (!(failure instanceof WorkbookWriteRefused)) throw failure
    }
  }
  return shown
}
