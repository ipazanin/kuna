import 'fake-indexeddb/auto'
import type { Label } from '../src/shared/categorising/domain/labels'
import { afterEach, describe, expect, it } from 'vitest'

import { CATEGORY_WRITES, deleteInto, newCategory } from '../src/apps/spending/categories/application/categoryWrites'
import { deleteLabel } from '../src/apps/spending/labels/application/labelWrites'
import { ACCOUNT_WRITES } from '../src/apps/spending/accounts/application/accountWrites'
import { addEntryFromShortcut, addShortcut, changeShortcut, deleteShortcut, entryOfShortcut, moveShortcut, newShortcut } from '../src/apps/spending/shortcuts/application/shortcutWrites'
import { repeatsWithoutShortcut, shortcutDraftOf, shortcutsShown, shortcutsWithParts } from '../src/apps/spending/shortcuts/domain/shortcuts'
import type { ShortcutWithParts } from '../src/apps/spending/shortcuts/domain/shortcuts'
import { codecOfSpendingKind } from '../src/apps/spending/workbook/application/spendingCodecs'
import type { Category } from '../src/apps/spending/workbook/domain/category'
import type { Shortcut, ShortcutPart } from '../src/apps/spending/workbook/domain/shortcut'
import { SHORTCUT_CODEC, SHORTCUT_PART_CODEC } from '../src/apps/spending/workbook/domain/shortcutReading'
import type { SpendingBooks } from '../src/apps/spending/workbook/domain/spendingBooks'
import { ACCOUNT_RECORDS, CATEGORY_RECORDS, LABEL_RECORDS, SHORTCUT_PART_RECORDS, SHORTCUT_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import { spendingDocumentOf } from '../src/apps/spending/workbook/infrastructure/spendingDocument'
import { accountMoneyFromAmount } from '../src/shared/money/accountMoney'
import type { WorkbookStore } from '../src/shared/storage/application/createWorkbookStore'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import type { RecordKind } from '../src/shared/storage/domain/recordKind'
import { storedFieldsOfValues } from '../src/shared/storage/domain/storedFields'
import { civil } from './fixtures/ledger'
import { CASH, OTP, row, spendingBook } from './fixtures/spending'
import { SPENDING, browserHarness, forgetCaches } from './fixtures/writeBack'

const used = new Set<string>()
afterEach(async () => forgetCaches(used))

function category(key: string, name: string, kind: Category['kind'], parent: Category | null = null): Category {
  return { id: recordIdOf(CATEGORY_RECORDS, `5e000000-0000-4000-8000-0000000090${key}`), name, kind, parent: parent?.id ?? null, order: 1, colour: '', hidden: false, role: null }
}

const FOOD = category('01', 'Food', 'spending')
const COFFEE = category('02', 'Coffee', 'spending', FOOD)
const TIPS = category('03', 'Tips', 'spending')
const EATING_OUT = category('04', 'Eating out', 'spending')
const TRANSFER = category('05', 'Between my accounts', 'transfer')
const CATEGORIES = [FOOD, COFFEE, TIPS, EATING_OUT, TRANSFER]
const MORNINGS: Label = { id: recordIdOf(LABEL_RECORDS, '5e000000-0000-4000-8000-000000009101'), name: 'Mornings' }

const COFFEE_SHORTCUT: Shortcut = { id: recordIdOf(SHORTCUT_RECORDS, '5e000000-0000-4000-8000-000000009201'), order: 1, name: 'Coffee', account: CASH.id, payee: 'Café on the square' }
const COFFEE_PART: ShortcutPart = {
  id: recordIdOf(SHORTCUT_PART_RECORDS, '5e000000-0000-4000-8000-000000009301'),
  shortcut: COFFEE_SHORTCUT.id,
  amount: accountMoneyFromAmount(-1.8),
  category: COFFEE.id,
  note: '',
  labels: [MORNINGS.id],
}
const TIP_PART: ShortcutPart = {
  id: recordIdOf(SHORTCUT_PART_RECORDS, '5e000000-0000-4000-8000-000000009302'),
  shortcut: COFFEE_SHORTCUT.id,
  amount: accountMoneyFromAmount(-0.2),
  category: TIPS.id,
  note: 'Tip',
  labels: [],
}

function stored<R>(kind: RecordKind<R>, records: readonly R[]) {
  const codec = codecOfSpendingKind(kind)
  return { [kind.name]: records.map((record) => codec.fieldsOf(record)) }
}

async function storeWith(shortcuts: readonly Shortcut[], parts: readonly ShortcutPart[]): Promise<WorkbookStore<SpendingBooks>> {
  const document = spendingDocumentOf('2026-11-04T09:00:00.000Z', {
    ...stored(ACCOUNT_RECORDS, [OTP, CASH]),
    ...stored(CATEGORY_RECORDS, CATEGORIES),
    ...stored(LABEL_RECORDS, [MORNINGS]),
    ...stored(SHORTCUT_RECORDS, shortcuts),
    ...stored(SHORTCUT_PART_RECORDS, parts),
  })
  const { store } = await browserHarness(used, document, SPENDING)
  return store
}

const heldOf = (store: WorkbookStore<SpendingBooks>): readonly ShortcutWithParts[] => shortcutsWithParts(store.state.workbook!)
const problemsOf = (store: WorkbookStore<SpendingBooks>) => store.state.workbook!.problems.map((problem) => [problem.kind, problem.reason])

describe('a quick add as the file stores it', () => {
  it('round-trips a quick add and its part', () => {
    expect(SHORTCUT_CODEC.make(storedFieldsOfValues(SHORTCUT_CODEC.fieldsOf(COFFEE_SHORTCUT)), COFFEE_SHORTCUT.id)).toEqual(COFFEE_SHORTCUT)
    expect(SHORTCUT_PART_CODEC.make(storedFieldsOfValues(SHORTCUT_PART_CODEC.fieldsOf(COFFEE_PART)), COFFEE_PART.id)).toEqual(COFFEE_PART)
  })

  it('reads a quick add with its two parts, in order', async () => {
    const later = { ...COFFEE_SHORTCUT, id: recordIdOf(SHORTCUT_RECORDS, '5e000000-0000-4000-8000-000000009202'), order: 0, name: 'Bread' }
    const bread = { ...TIP_PART, id: recordIdOf(SHORTCUT_PART_RECORDS, '5e000000-0000-4000-8000-000000009303'), shortcut: later.id }
    const store = await storeWith([COFFEE_SHORTCUT, later], [COFFEE_PART, TIP_PART, bread])

    expect(heldOf(store).map(({ shortcut, parts }) => [shortcut.name, parts.length])).toEqual([
      ['Bread', 1],
      ['Coffee', 2],
    ])
    expect(problemsOf(store)).toEqual([])
  })

  it('leaves out every part of a quick add when one goes the other way, and the quick add with them', async () => {
    const store = await storeWith([COFFEE_SHORTCUT], [COFFEE_PART, { ...TIP_PART, amount: accountMoneyFromAmount(0.2) }])

    expect(heldOf(store)).toEqual([])
    expect(problemsOf(store)).toEqual([
      ['shortcut', 'has no part, so it writes nothing'],
      ['shortcut-part', 'goes the other way from another part of its quick add'],
      ['shortcut-part', 'goes the other way from another part of its quick add'],
    ])
  })

  it('refuses a part under Between my accounts', async () => {
    const store = await storeWith([COFFEE_SHORTCUT], [{ ...COFFEE_PART, category: TRANSFER.id }])

    expect(problemsOf(store).slice(1)).toEqual([['shortcut-part', 'is filed under Between my accounts, which a quick add cannot write']])
  })

  it('lets a category a part is on take a category under it, and keeps reading the part there', async () => {
    const store = await storeWith([COFFEE_SHORTCUT], [COFFEE_PART, TIP_PART])
    const waiters = newCategory({ name: 'Waiters', kind: 'spending', parent: TIPS.id, order: 2, colour: '', hidden: false, role: null })

    await store.write('Added', (unit) => unit.of(CATEGORY_WRITES).add(waiters))

    expect(store.state.workbook!.categories.map((held) => held.name)).toContain('Waiters')
    expect(heldOf(store)[0]!.parts.map((part) => part.category)).toEqual([COFFEE.id, TIPS.id])
    expect(problemsOf(store)).toEqual([])
  })
})

describe('the entry a quick add writes', () => {
  it('is a typed entry not split for one part, with its category, note and labels, joining an event by its day', () => {
    const entry = entryOfShortcut({ shortcut: COFFEE_SHORTCUT, parts: [COFFEE_PART] }, civil('2026-11-16'))

    expect(entry.row).toMatchObject({ account: CASH.id, date: '2026-11-16', amount: accountMoneyFromAmount(-1.8), payee: 'Café on the square', source: 'typed', categorisedBy: 'person' })
    expect(entry.items).toMatchObject([{ amount: accountMoneyFromAmount(-1.8), category: COFFEE.id, labels: [MORNINGS.id], event: 'days' }])
  })

  it('is one entry split into the parts, of the parts added up', () => {
    const entry = entryOfShortcut({ shortcut: COFFEE_SHORTCUT, parts: [COFFEE_PART, TIP_PART] }, civil('2026-11-16'))

    expect(entry.row.amount).toEqual(accountMoneyFromAmount(-2))
    expect(entry.items.map((item) => [item.amount, item.category, item.note])).toEqual([
      [accountMoneyFromAmount(-1.8), COFFEE.id, ''],
      [accountMoneyFromAmount(-0.2), TIPS.id, 'Tip'],
    ])
  })

  it('is written with one Undo that takes it back', async () => {
    const store = await storeWith([COFFEE_SHORTCUT], [COFFEE_PART, TIP_PART])
    const written = await store.write('Added', (unit) => addEntryFromShortcut(unit, store.state.records!, heldOf(store)[0]!, civil('2026-11-16')))

    expect(store.state.workbook!.transactions.map((entry) => entry.amount)).toEqual([accountMoneyFromAmount(-2)])
    expect(store.state.workbook!.items).toHaveLength(2)

    await store.undo(store.state.writes.find((write) => write.receipt === written)!)

    expect(store.state.workbook!.transactions).toEqual([])
  })
})

describe('quick adds shown on Entries', () => {
  it('leave out one on a closed account or one the bank fills', () => {
    const onBank = { ...COFFEE_SHORTCUT, id: recordIdOf(SHORTCUT_RECORDS, '5e000000-0000-4000-8000-000000009203'), account: OTP.id }
    const book = spendingBook([], { accounts: [OTP, CASH], shortcuts: [COFFEE_SHORTCUT, onBank], shortcutParts: [COFFEE_PART, { ...COFFEE_PART, shortcut: onBank.id }] })

    expect(shortcutsShown(book).map(({ shortcut }) => shortcut.id)).toEqual([COFFEE_SHORTCUT.id])
    expect(shortcutsShown({ ...book, accounts: [OTP, { ...CASH, closed: true }] })).toEqual([])
  })
})

describe('a typed entry that repeats', () => {
  const coffee = { account: CASH.id, payee: 'Café on the square', amount: accountMoneyFromAmount(-1.8), category: COFFEE.id }
  const typed = (date: string, payee = 'café on the square') => row(CASH, date, -1.8, null, { payee, category: COFFEE.id })

  it('is offered a quick add on the third time in 30 days, its payee folded', () => {
    const book = spendingBook([typed('2026-10-20'), typed('2026-11-10')], { categories: CATEGORIES })

    expect(repeatsWithoutShortcut(book, coffee, civil('2026-11-16'))).toBe(true)
    expect(repeatsWithoutShortcut(book, { ...coffee, amount: accountMoneyFromAmount(-2) }, civil('2026-11-16'))).toBe(false)
  })

  it('is not offered one when an earlier time is more than 30 days back, or a quick add writes it already', () => {
    // 2026-10-17 is the 31st day back from 2026-11-16, counting the day itself.
    const book = spendingBook([typed('2026-10-17'), typed('2026-11-10')], { categories: CATEGORIES })
    const covered = spendingBook([typed('2026-10-20'), typed('2026-11-10')], { categories: CATEGORIES, shortcuts: [COFFEE_SHORTCUT], shortcutParts: [COFFEE_PART] })

    expect(repeatsWithoutShortcut(book, coffee, civil('2026-11-16'))).toBe(false)
    expect(repeatsWithoutShortcut(covered, coffee, civil('2026-11-16'))).toBe(false)
  })

  it('makes a quick add of its account, payee and parts, and none while it waits on review', () => {
    const entry = entryOfShortcut({ shortcut: COFFEE_SHORTCUT, parts: [COFFEE_PART, TIP_PART] }, civil('2026-11-16'))

    expect(shortcutDraftOf(entry.row, entry.items)).toEqual({
      name: '',
      account: CASH.id,
      payee: 'Café on the square',
      parts: [
        { amount: COFFEE_PART.amount, category: COFFEE.id, note: '', labels: [MORNINGS.id] },
        { amount: TIP_PART.amount, category: TIPS.id, note: 'Tip', labels: [] },
      ],
    })
    expect(shortcutDraftOf(entry.row, [{ ...entry.items[0]!, category: null }])).toBeNull()
  })
})

describe('quick add writes', () => {
  it('adds, changes, moves and deletes a quick add', async () => {
    const store = await storeWith([], [])
    const draft = { name: ' Coffee ', account: CASH.id, payee: 'Café', parts: [{ amount: accountMoneyFromAmount(-1.8), category: COFFEE.id, note: '', labels: [] }] }
    await store.write('Added', (unit) => addShortcut(unit, newShortcut(store.state.records!, draft)))
    await store.write('Added', (unit) => addShortcut(unit, newShortcut(store.state.records!, { ...draft, name: 'Bread' })))

    expect(heldOf(store).map(({ shortcut }) => [shortcut.name, shortcut.order])).toEqual([
      ['Coffee', 1],
      ['Bread', 2],
    ])

    await store.write('Moved', (unit) => moveShortcut(unit, store.state.workbook!.shortcuts, store.state.workbook!.shortcuts[1]!, -1))
    expect(heldOf(store).map(({ shortcut }) => shortcut.name)).toEqual(['Bread', 'Coffee'])

    await store.write('Saved', (unit) =>
      changeShortcut(unit, heldOf(store)[1]!, { ...draft, parts: [...draft.parts, { amount: accountMoneyFromAmount(-0.2), category: TIPS.id, note: '', labels: [] }] }),
    )
    expect(heldOf(store)[1]!.parts.map((part) => part.category)).toEqual([COFFEE.id, TIPS.id])

    await store.write('Deleted', (unit) => deleteShortcut(unit, heldOf(store)[0]!))
    expect(heldOf(store).map(({ shortcut }) => shortcut.name)).toEqual(['Coffee'])
    expect(store.state.workbook!.shortcutParts).toHaveLength(2)
  })

  it('moves the parts of a deleted category to the other, and takes a deleted label off them', async () => {
    const store = await storeWith([COFFEE_SHORTCUT], [COFFEE_PART, TIP_PART])
    await store.write('Deleted', (unit) => deleteInto(unit, store.state.records!, TIPS, EATING_OUT))
    await store.write('Deleted', (unit) => deleteLabel(unit, store.state.records!, MORNINGS))

    expect(store.state.workbook!.shortcutParts.map((part) => [part.category, part.labels])).toEqual([
      [COFFEE.id, []],
      [EATING_OUT.id, []],
    ])
  })

  it('refuses to delete an account a quick add is on', async () => {
    const store = await storeWith([COFFEE_SHORTCUT], [COFFEE_PART])

    await expect(store.write('Deleted', (unit) => unit.of(ACCOUNT_WRITES).remove(CASH))).rejects.toThrow(
      'The quick add "Coffee, Café on the square" would then be left out: names no account in the file.',
    )
    expect(heldOf(store)).toHaveLength(1)
  })
})
