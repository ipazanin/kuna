import { beforeEach, describe, expect, it, vi } from 'vitest'

const google = vi.hoisted(() => ({ asked: [] as unknown[] }))

vi.mock('../src/shared/google/googleAuth', () => ({
  currentToken: () => null,
  requestAccess: async (scopes: unknown, then: unknown) => {
    google.asked.push({ scopes, then })
  },
}))

import type { CheckedProposal } from '../src/shared/app/assistantOperations'
import { proposedWrites } from '../src/shared/app/proposedWrites'
import { GoogleAccessNeeded } from '../src/shared/google/googleAccessNeeded'
import { GoogleApiError } from '../src/shared/google/googleApi'
import { en as googleWords } from '../src/shared/google/words'
import type { BooksRead, SessionWrite } from '../src/shared/storage/application/createWorkbookStore'
import type { WriteReceipt } from '../src/shared/storage/application/recordWrites'
import { WorkbookWriteRefused } from '../src/shared/storage/application/workbookWriteRefused'
import { en as storageWords } from '../src/shared/storage/presentation/words'

const RECEIPT: WriteReceipt = { title: 'Add a category', records: [] }

/** A store whose write and undo fail with each failure given, in turn, and then go through. */
function failingStore(writeFailures: unknown[], undoFailures: unknown[] = []) {
  const writes: SessionWrite[] = []
  const calls = { write: 0, undo: 0 }
  const store = {
    state: { workbook: {}, records: {}, writes } as unknown as Parameters<typeof proposedWrites<BooksRead>>[0]['state'],
    check: vi.fn(),
    async write() {
      calls.write += 1
      const failure = writeFailures.shift()
      if (failure !== undefined) throw failure
      writes.push({ id: 1, at: '2026-11-09T10:00:00.000Z', workbookId: 'books', receipt: RECEIPT, undid: null } as unknown as SessionWrite)
      return RECEIPT
    },
    async undo() {
      calls.undo += 1
      const failure = undoFailures.shift()
      if (failure !== undefined) throw failure
    },
  }
  return { store, calls }
}

const proposal = (): CheckedProposal => ({
  title: 'Add a category',
  count: 0,
  groups: [],
  outside: [],
  undoable: true,
  heldBack: null,
  held: { title: 'Add a category', changes: [], books: {}, steps: [] },
})

const work = { notOpen: 'Not open.', plan: () => {}, groups: () => [] }

beforeEach(() => {
  google.asked = []
})

describe("a chat card's Accept and Undo with Drive books", () => {
  it('asks Google when the store finds the access missing, and writes once it is given', async () => {
    const { store, calls } = failingStore([new GoogleAccessNeeded(['drive.file'])])
    const result = await proposedWrites(store, work).accept(proposal())
    expect(result.kind).toBe('done')
    expect(google.asked).toEqual([{ scopes: ['drive.file'], then: { resume: 'none' } }])
    expect(calls.write).toBe(2)
  })

  it('writes without asking Google when the store needs no access, as for books kept in this browser', async () => {
    const { store, calls } = failingStore([])
    expect((await proposedWrites(store, work).accept(proposal())).kind).toBe('done')
    expect(google.asked).toEqual([])
    expect(calls.write).toBe(1)
  })

  it("shows the store's refusal, a Drive failure in plain words and any other failure by its own text", async () => {
    const reasons = []
    for (const failure of [
      new WorkbookWriteRefused('Nothing was written: the category changed since.'),
      new GoogleApiError('https://www.googleapis.com/drive/v3/files/x', 500, ''),
      new TypeError('Failed to fetch'),
      new Error(googleWords.popupClosed),
    ]) {
      const { store } = failingStore([failure])
      reasons.push(await proposedWrites(store, work).accept(proposal()))
    }
    expect(reasons).toEqual([
      { kind: 'refused', reason: 'Nothing was written: the category changed since.' },
      { kind: 'refused', reason: storageWords.driveFailed },
      { kind: 'refused', reason: storageWords.driveFailed },
      { kind: 'refused', reason: googleWords.popupClosed },
    ])
  })

  it('asks Google on Undo too, and says why when the undo still fails', async () => {
    const { store, calls } = failingStore([], [new GoogleAccessNeeded(['drive.file'])])
    const result = await proposedWrites(store, work).accept(proposal())
    if (result.kind !== 'done' || result.undo === null) throw new Error('the card has no Undo')
    expect(await result.undo()).toEqual({ kind: 'undone' })
    expect(google.asked).toEqual([{ scopes: ['drive.file'], then: { resume: 'none' } }])
    expect(calls.undo).toBe(2)

    const failing = failingStore([], [new GoogleApiError('https://www.googleapis.com/upload/drive/v3/files/x', 503, '')])
    const again = await proposedWrites(failing.store, work).accept(proposal())
    if (again.kind !== 'done' || again.undo === null) throw new Error('the card has no Undo')
    expect(await again.undo()).toEqual({ kind: 'refused', reason: storageWords.driveFailed })
  })
})
