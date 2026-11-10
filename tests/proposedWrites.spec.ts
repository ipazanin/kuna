import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { CATEGORY_WRITES } from '../src/apps/spending/categories/application/categoryWrites'
import type { SpendingBooks } from '../src/apps/spending/workbook/domain/spendingBooks'
import { fakeSpendingDocument } from '../src/apps/spending/workbook/infrastructure/fake/fakeSpending'
import { NO_FILE_YET } from '../src/shared/app/assistantOperations'
import type { CheckedProposal, ProposalStep } from '../src/shared/app/assistantOperations'
import { words } from '../src/shared/app/words'
import { parseCivilDate } from '../src/shared/calendar/civilDate'
import type { WorkbookStore } from '../src/shared/storage/application/createWorkbookStore'
import { StepRefused, proposedWrites } from '../src/shared/app/proposedWrites'
import type { ProposalWork } from '../src/shared/app/proposedWrites'
import { SPENDING, browserHarness, forgetCaches } from './fixtures/writeBack'

const DAY = parseCivilDate('2026-11-07')!
const used = new Set<string>()

afterEach(async () => forgetCaches(used))

async function spendingStore(): Promise<WorkbookStore<SpendingBooks>> {
  const { store } = await browserHarness(used, fakeSpendingDocument('2026-11-07T09:00:00.000Z', 'people', DAY), SPENDING)
  return store as unknown as WorkbookStore<SpendingBooks>
}

/**
 * Renames categories, each step one, with what `beforeWrite` kept added to the name once it has run. A kept `other:` names another category to rename instead.
 * A work that keeps something says so outside the books unless `effects` says otherwise.
 */
function renaming(events: string[] = [], effects: Pick<ProposalWork<SpendingBooks, string>, 'beforeWrite' | 'outside'> = {}): ProposalWork<SpendingBooks, string> {
  return {
    ...(effects.beforeWrite === undefined ? {} : { outside: () => ['A file stays on Drive after Undo.'] }),
    notOpen: 'Not open.',
    plan(unit, books, steps, kept) {
      events.push(`plan ${kept ?? 'unrun'}`)
      for (const { input } of steps) {
        const id = kept?.startsWith('other:') === true ? kept.slice('other:'.length) : input['category']
        const category = books.workbook.categories.find((candidate) => candidate.id === id)
        if (category === undefined) throw new StepRefused('No such category.')
        unit.of(CATEGORY_WRITES).change(category, { ...category, name: kept === undefined ? String(input['name']) : `${String(input['name'])} ${kept}` })
      }
    },
    groups: (checked) => [{ verb: 'change', noun: CATEGORY_WRITES.kind.noun, notes: [], lines: checked.changes.map(() => ({ label: 'A category', fields: [], warning: null })) }],
    ...effects,
  }
}

const rename = (category: string, name: string): ProposalStep => ({ operation: 'rename', input: { category, name }, as: null })
const named = (store: WorkbookStore<SpendingBooks>, name: string) => store.state.workbook!.categories.find((category) => category.name === name)

async function checked(store: WorkbookStore<SpendingBooks>, work: ProposalWork<SpendingBooks, string>, steps: readonly ProposalStep[]): Promise<CheckedProposal> {
  const proposal = await proposedWrites(store, work).check('A title', steps)
  if ('refused' in proposal) throw new Error(proposal.refused.join(' '))
  return proposal
}

describe('a proposed write', () => {
  it('checks the steps against the books on screen and writes nothing', async () => {
    const store = await spendingStore()
    const groceries = named(store, 'Groceries')!
    const writes = store.state.writes.length

    const proposal = await checked(store, renaming(), [rename(groceries.id, 'Food shop')])

    expect(proposal).toMatchObject({ title: 'A title', count: 1, outside: [] })
    expect(named(store, 'Groceries')).toBeDefined()
    expect(store.state.writes).toHaveLength(writes)
  })

  it('refuses a step the plan refuses, with its sentence', async () => {
    const store = await spendingStore()
    expect(await proposedWrites(store, renaming()).check('A title', [rename('category-gone', 'Gone')])).toEqual({ refused: ['No such category.'] })
  })

  it('refuses a step that changes nothing', async () => {
    const store = await spendingStore()
    const groceries = named(store, 'Groceries')!
    expect(await proposedWrites(store, renaming()).check('A title', [rename(groceries.id, 'Groceries')])).toEqual({ refused: ['Nothing would change.'] })
  })

  it('writes on Accept in one write, and Undo puts it back once', async () => {
    const store = await spendingStore()
    const groceries = named(store, 'Groceries')!
    const writes = store.state.writes.length
    const work = renaming()
    const proposal = await checked(store, work, [rename(groceries.id, 'Food shop')])

    const result = await proposedWrites(store, work).accept(proposal)

    expect(result.kind).toBe('done')
    expect(named(store, 'Food shop')).toBeDefined()
    expect(store.state.writes).toHaveLength(writes + 1)
    if (result.kind !== 'done') return
    expect(proposal.undoable).toBe(true)
    expect(await result.undo!()).toEqual({ kind: 'undone' })
    expect(named(store, 'Groceries')).toBeDefined()
    expect((await result.undo!()).kind).toBe('refused')
  })

  it('says a card has no Undo when it writes a kind that keeps none, and Accept gives none', async () => {
    const store = await spendingStore()
    const groceries = named(store, 'Groceries')!
    const work: ProposalWork<SpendingBooks, string> = {
      ...renaming(),
      plan(unit, books, steps) {
        const category = books.workbook.categories.find((candidate) => candidate.id === steps[0]!.input['category'])!
        unit.of({ ...CATEGORY_WRITES, undoable: false }).change(category, { ...category, name: 'Food shop' })
      },
    }
    const proposal = await checked(store, work, [rename(groceries.id, 'Food shop')])
    expect(proposal.undoable).toBe(false)

    const result = await proposedWrites(store, work).accept(proposal)
    expect(result).toMatchObject({ kind: 'done', undo: null })
  })

  it('refuses a card whose record changed since its check, and writes nothing of it', async () => {
    const store = await spendingStore()
    const groceries = named(store, 'Groceries')!
    const work = renaming()
    const first = await checked(store, work, [rename(groceries.id, 'Food shop')])
    const second = await checked(store, work, [rename(groceries.id, 'Shop')])

    expect((await proposedWrites(store, work).accept(first)).kind).toBe('done')
    expect((await proposedWrites(store, work).accept(second)).kind).toBe('refused')
    expect(named(store, 'Food shop')).toBeDefined()
    expect(named(store, 'Shop')).toBeUndefined()
  })

  it('runs beforeWrite on Accept before the write, and writes with what it kept', async () => {
    const store = await spendingStore()
    const groceries = named(store, 'Groceries')!
    const events: string[] = []
    const work = renaming(events, {
      beforeWrite: async () => {
        events.push('before write')
        return 'kept-on-drive'
      },
    })
    const proposal = await checked(store, work, [rename(groceries.id, 'Food shop')])
    expect(events).toEqual(['plan unrun'])

    const result = await proposedWrites(store, work).accept(proposal)

    expect(result.kind).toBe('done')
    expect(events).toEqual(['plan unrun', 'before write', 'plan kept-on-drive'])
    expect(named(store, 'Food shop kept-on-drive')).toBeDefined()
  })

  it('writes the checked changes without beforeWrite when the steps keep nothing outside the books', async () => {
    const store = await spendingStore()
    const groceries = named(store, 'Groceries')!
    const events: string[] = []
    const work = renaming(events, {
      beforeWrite: async () => {
        events.push('before write')
        return 'kept'
      },
      outside: () => [],
    })
    const proposal = await checked(store, work, [rename(groceries.id, 'Food shop')])

    expect((await proposedWrites(store, work).accept(proposal)).kind).toBe('done')
    expect(events).toEqual(['plan unrun'])
    expect(named(store, 'Food shop')).toBeDefined()
  })

  it('refuses with the reason when beforeWrite fails, and writes nothing', async () => {
    const store = await spendingStore()
    const groceries = named(store, 'Groceries')!
    const writes = store.state.writes.length
    const work = renaming([], {
      beforeWrite: async () => {
        throw new Error('Kuna has no access to the receipts folder.')
      },
    })
    const proposal = await checked(store, work, [rename(groceries.id, 'Food shop')])

    expect(await proposedWrites(store, work).accept(proposal)).toEqual({ kind: 'refused', reason: 'Kuna has no access to the receipts folder.' })
    expect(store.state.writes).toHaveLength(writes)
  })

  it('refuses a stale card before beforeWrite runs, so nothing is kept outside the books', async () => {
    const store = await spendingStore()
    const groceries = named(store, 'Groceries')!
    const events: string[] = []
    const keeping = renaming(events, {
      beforeWrite: async () => {
        events.push('before write')
        return 'kept'
      },
    })
    const stale = await checked(store, keeping, [rename(groceries.id, 'Shop')])
    expect((await proposedWrites(store, renaming()).accept(await checked(store, renaming(), [rename(groceries.id, 'Food shop')]))).kind).toBe('done')

    expect((await proposedWrites(store, keeping).accept(stale)).kind).toBe('refused')
    expect(events).not.toContain('before write')
    expect(named(store, 'Food shop')).toBeDefined()
  })

  it('refuses when the plan with what beforeWrite kept touches other records than the card showed, and writes nothing', async () => {
    const store = await spendingStore()
    const groceries = named(store, 'Groceries')!
    const other = store.state.workbook!.categories.find((category) => category.id !== groceries.id)!
    const writes = store.state.writes.length
    const work = renaming([], { beforeWrite: async () => `other:${other.id}` })
    const proposal = await checked(store, work, [rename(groceries.id, 'Food shop')])

    expect(await proposedWrites(store, work).accept(proposal)).toEqual({ kind: 'refused', reason: words.proposalChangedOnAccept })
    expect(store.state.writes).toHaveLength(writes)
  })

  it('shows its outside lines on the card, and Undo puts back the records and leaves what is outside', async () => {
    const store = await spendingStore()
    const groceries = named(store, 'Groceries')!
    const drive: string[] = []
    const work = renaming([], {
      beforeWrite: async () => {
        drive.push('photo.jpg')
        return 'kept'
      },
      outside: () => ['The photo stays on Drive after Undo.'],
    })
    const proposal = await checked(store, work, [rename(groceries.id, 'Food shop')])
    expect(proposal.outside).toEqual(['The photo stays on Drive after Undo.'])

    const result = await proposedWrites(store, work).accept(proposal)
    if (result.kind !== 'done') throw new Error('Accept was refused.')
    expect(await result.undo!()).toEqual({ kind: 'undone' })

    expect(named(store, 'Groceries')).toBeDefined()
    expect(drive).toEqual(['photo.jpg'])
  })

  it('refuses while the file is not open, and says how an app with no file gets one', async () => {
    const store = await spendingStore()
    const closed = { ...store, state: { ...store.state, workbook: null } }
    expect(await proposedWrites(closed, renaming()).check('A title', [])).toEqual({ refused: ['Not open.', NO_FILE_YET] })
  })
})
