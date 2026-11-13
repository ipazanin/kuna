import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { CATEGORY_WRITES, newCategory } from '../src/apps/spending/categories/application/categoryWrites'
import { newEntry, writeEntry } from '../src/apps/spending/entries/application/entryWrites'
import { SETTING_WRITES } from '../src/apps/spending/workbook/application/settingWrites'
import { setSetting } from '../src/shared/storage/application/settingWrites'
import { settingRow } from '../src/shared/storage/domain/settingRows'
import { codecOfSpendingKind } from '../src/apps/spending/workbook/application/spendingCodecs'
import { isFixedKind } from '../src/apps/spending/workbook/domain/category'
import type { SpendingBooks } from '../src/apps/spending/workbook/domain/spendingBooks'
import { ACCOUNT_RECORDS, CATEGORY_RECORDS, SETTING_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import { BANK_SYNC_DEPLOYMENT_KEY } from '../src/apps/spending/workbook/domain/spendingSettings'
import { spendingDocumentOf } from '../src/apps/spending/workbook/infrastructure/spendingDocument'
import { accountMoneyFromAmount } from '../src/shared/money/accountMoney'
import { canUndo } from '../src/shared/storage/application/createWorkbookStore'
import type { WorkbookStore } from '../src/shared/storage/application/createWorkbookStore'
import type { UnitOfWork } from '../src/shared/storage/application/repository'
import type { RecordKind } from '../src/shared/storage/domain/recordKind'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { recordsOf } from '../src/shared/storage/domain/recordsRead'
import { civil } from './fixtures/ledger'
import { ACCOUNTS, CATEGORIES, category } from './fixtures/spending'
import { SPENDING, browserHarness, forgetCaches } from './fixtures/writeBack'

const used = new Set<string>()

afterEach(async () => {
  await forgetCaches(used)
})

function stored<R>(kind: RecordKind<R>, records: readonly R[]) {
  const codec = codecOfSpendingKind(kind)
  return { [kind.name]: records.map((record) => codec.fieldsOf(record)) }
}

type SpendingStore = WorkbookStore<SpendingBooks>

async function spendingStore(): Promise<SpendingStore> {
  const document = spendingDocumentOf('2026-11-04T09:00:00.000Z', { ...stored(ACCOUNT_RECORDS, ACCOUNTS), ...stored(CATEGORY_RECORDS, CATEGORIES) })
  const { store } = await browserHarness(used, document, SPENDING)
  return store
}

function saveDeployment(store: SpendingStore, deployment: string): (unit: UnitOfWork) => void {
  return (unit) => setSetting(unit, SETTING_WRITES, recordsOf(store.state.records!.settings), BANK_SYNC_DEPLOYMENT_KEY, deployment)
}

const fixedCategory = CATEGORIES.find((candidate) => isFixedKind(candidate.kind))!

const CASES: readonly { readonly name: string; readonly outcome: 'ready' | 'nothingToChange' | 'refused'; readonly work: (store: SpendingStore) => (unit: UnitOfWork) => void }[] = [
  {
    name: 'a new category',
    outcome: 'ready',
    work: () => (unit) => unit.of(CATEGORY_WRITES).add(newCategory({ ...category('Food/Coffee'), name: 'Pastries' })),
  },
  {
    name: 'a setting saved',
    outcome: 'ready',
    work: (store) => saveDeployment(store, 'AKfy-first'),
  },
  {
    name: 'a blank setting that was never saved',
    outcome: 'nothingToChange',
    work: (store) => saveDeployment(store, ''),
  },
  {
    name: 'a fixed category deleted',
    outcome: 'refused',
    work: () => (unit) => unit.of(CATEGORY_WRITES).remove(fixedCategory),
  },
  {
    name: 'a setting that is not in the file changed',
    outcome: 'refused',
    work: () => (unit) => unit.of(SETTING_WRITES).change(settingRow(SETTING_RECORDS, 'made_up_key', 'before'), settingRow(SETTING_RECORDS, 'made_up_key', 'after')),
  },
  {
    name: 'an entry on an account the file does not hold',
    outcome: 'refused',
    work: (store) => (unit) =>
      writeEntry(
        unit,
        store.state.records!,
        null,
        newEntry({
          account: recordIdOf(ACCOUNT_RECORDS, 'made-up-account'),
          date: civil('2026-10-16'),
          amount: accountMoneyFromAmount(-3.5),
          payee: 'Corner cafe',
          category: category('Food/Coffee').id,
          note: '',
        }),
        null,
      ),
  },
]

describe('Checking a write', () => {
  it.each(CASES)('gives for $name what a write meets', async ({ outcome, work }) => {
    const store = await spendingStore()

    const checked = await store.check('Proposed', work(store))
    const written = store.write('Proposed', work(store))

    expect(checked.status).toBe(outcome)
    if (checked.status === 'refused') {
      await expect(written).rejects.toThrow(checked.reason)
    } else if (checked.status === 'nothingToChange') {
      await expect(written).resolves.toBeNull()
    } else {
      await expect(written).resolves.toMatchObject({ title: checked.checked.title })
    }
  })

  it.each(CASES)('leaves the screen, the queue and the history as they were for $name', async ({ work }) => {
    const store = await spendingStore()
    const { records, workbook, snapshot } = store.state

    await store.check('Proposed', work(store))

    expect(store.state.waiting).toEqual([])
    expect(store.state.writes).toEqual([])
    expect(store.state.records).toBe(records)
    expect(store.state.workbook).toBe(workbook)
    expect(store.state.snapshot).toBe(snapshot)
    expect(store.state.status).toBe('ready')
  })

  it('refuses with no books on screen, as a write does', async () => {
    const store = await spendingStore()
    await store.dropWorkbook(store.state.snapshot!.meta.id)

    const checked = await store.check('Proposed', () => {})

    expect(checked.status).toBe('refused')
    await expect(store.write('Proposed', () => {})).rejects.toThrow()
  })
})

describe('Spending settings', () => {
  it('can be undone', async () => {
    const store = await spendingStore()

    await store.write('Saved', saveDeployment(store, 'AKfy-first'))
    const [saved] = store.state.writes
    await store.undo(saved!)

    expect(canUndo(saved!, store.state.writes)).toBe(false)
    expect(recordsOf(store.state.records!.settings)).toEqual([])
  })

  it('is offered Undo until it is undone', async () => {
    const store = await spendingStore()

    await store.write('Saved', saveDeployment(store, 'AKfy-first'))

    expect(canUndo(store.state.writes[0]!, store.state.writes)).toBe(true)
  })

  it('goes back to the value it held when a change is undone', async () => {
    const store = await spendingStore()
    await store.write('Saved', saveDeployment(store, 'AKfy-first'))
    await store.write('Changed', saveDeployment(store, 'AKfy-second'))

    await store.undo(store.state.writes[0]!)

    expect(recordsOf(store.state.records!.settings).map((row) => row.value)).toEqual(['AKfy-first'])
  })
})
