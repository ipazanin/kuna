import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { KEPT_BY_KUNA } from '../src/apps/spending/assistant/operations/proposalLines'
import { SPENDING_OPERATIONS, spendingProposer } from '../src/apps/spending/assistant/operations/spendingOperations'
import { words } from '../src/apps/spending/assistant/words'
import { codecOfSpendingKind } from '../src/apps/spending/workbook/application/spendingCodecs'
import { ACCOUNT_RECORDS, BUDGET_RECORDS, CATEGORY_RECORDS, RECEIPT_RECORDS, RULE_RECORDS, TRANSACTION_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import type { SpendingBooks } from '../src/apps/spending/workbook/domain/spendingBooks'
import { spendingDocumentOf } from '../src/apps/spending/workbook/infrastructure/spendingDocument'
import type { WorkbookStore } from '../src/shared/storage/application/createWorkbookStore'
import type { RuledChange } from '../src/shared/storage/application/recordWrites'
import type { RecordKind } from '../src/shared/storage/domain/recordKind'
import type { WorkbookDocument } from '../src/shared/storage/infrastructure/documentFormat'
import { CHAT_BOOK } from './fixtures/chatBook'
import { SPENDING, browserHarness, forgetCaches } from './fixtures/writeBack'

const used = new Set<string>()
afterEach(async () => forgetCaches(used))

/** The record each example names by its kind, from the chat's book. */
const RECORDS: Readonly<Record<string, string>> = {
  category: CHAT_BOOK.categories.find((category) => category.name === 'Rent')!.id,
  'category-other': CHAT_BOOK.categories.find((category) => category.name === 'Groceries')!.id,
  transaction: CHAT_BOOK.transactions.find((row) => row.payee === 'Corner market')!.id,
  account: CHAT_BOOK.accounts[0]!.id,
  rule: CHAT_BOOK.rules[0]!.id,
}

function stored<R>(kind: RecordKind<R>, records: readonly R[]): WorkbookDocument['records'] {
  return { [kind.name]: records.map((record) => codecOfSpendingKind(kind).fieldsOf(record)) }
}

async function chatBookStore(): Promise<WorkbookStore<SpendingBooks>> {
  const document = spendingDocumentOf('2026-11-07T09:00:00.000Z', {
    ...stored(ACCOUNT_RECORDS, CHAT_BOOK.accounts),
    ...stored(CATEGORY_RECORDS, CHAT_BOOK.categories),
    ...stored(TRANSACTION_RECORDS, CHAT_BOOK.transactions),
    ...stored(BUDGET_RECORDS, CHAT_BOOK.budgets),
    ...stored(RULE_RECORDS, CHAT_BOOK.rules),
    ...stored(RECEIPT_RECORDS, CHAT_BOOK.receipts),
  })
  const { store } = await browserHarness(used, document, SPENDING)
  return store as unknown as WorkbookStore<SpendingBooks>
}

/** A field's value as the card reads it, where an empty text and a missing value both say nothing. */
function said(value: unknown): unknown {
  return value === undefined || value === '' ? null : value
}

/** The card's names of the fields a change sets, leaving out the ones Kuna keeps by itself. */
function namesSet(before: Readonly<Record<string, unknown>> | null, after: Readonly<Record<string, unknown>>): string[] {
  const fields = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after)])].filter((field) => !KEPT_BY_KUNA.has(field))
  const altered = fields.filter((field) => JSON.stringify(said(before?.[field])) !== JSON.stringify(said(after[field])))
  return altered.map((field) => (words.proposals.fields as Readonly<Record<string, string>>)[field] ?? field)
}

describe('the card of every operation', () => {
  it.each(SPENDING_OPERATIONS.map((operation) => [operation.name, operation] as const))('names every field the example sets: %s', async (_name, operation) => {
    expect(Object.keys(operation.input.type === 'object' ? operation.input.properties : {}).filter((field) => KEPT_BY_KUNA.has(field))).toEqual([])
    const store = await chatBookStore()
    const input = Object.fromEntries(Object.entries(operation.example).map(([field, value]) => [field, field in operation.refs && typeof value === 'string' ? RECORDS[value] : value]))

    const proposal = await spendingProposer(store).check('Example', [{ operation: operation.name, input, as: null }])

    if ('refused' in proposal) throw new Error(proposal.refused.join(' '))
    const { changes } = proposal.held as { readonly changes: readonly RuledChange[] }
    const linesTaken = new Map<string, number>()
    const checked = changes.flatMap(({ change }) => {
      if (change.verb === 'repair' || change.verb === 'discard') return []
      const group = proposal.groups.find((candidate) => candidate.verb === change.verb && candidate.noun === change.kind.noun)!
      const at = linesTaken.get(`${change.verb}/${change.kind.name}`) ?? 0
      linesTaken.set(`${change.verb}/${change.kind.name}`, at + 1)
      if (change.verb === 'remove') return []
      const before = change.verb === 'change' ? (change.before as Readonly<Record<string, unknown>>) : null
      return [{ shown: group.lines[at]!.fields.map((field) => field.name), set: namesSet(before, change.after as Readonly<Record<string, unknown>>) }]
    })
    expect(changes.length).toBeGreaterThan(0)
    for (const { shown, set } of checked) expect(shown).toEqual(expect.arrayContaining(set))
  })
})
