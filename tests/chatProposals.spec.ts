import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { SPENDING_OPERATIONS, spendingAcceptance, spendingProposer } from '../src/apps/spending/assistant/operations/spendingOperations'
import { SETTING_WRITES } from '../src/apps/spending/workbook/application/settingWrites'
import type { SpendingBooks } from '../src/apps/spending/workbook/domain/spendingBooks'
import { BANK_SYNC_DEPLOYMENT_KEY, COMPANY_OIB_KEY } from '../src/apps/spending/workbook/domain/spendingSettings'
import { fakeSpendingDocument } from '../src/apps/spending/workbook/infrastructure/fake/fakeSpending'
import type { CheckedProposal } from '../src/shared/app/assistantOperations'
import { proposeChanges } from '../src/shared/ai/application/chatProposals'
import type { ChatReads } from '../src/shared/ai/application/chatReads'
import { chatRefs } from '../src/shared/ai/domain/chatRefs'
import { chatAliases } from '../src/shared/ai/domain/sensitiveText'
import { parseCivilDate } from '../src/shared/calendar/civilDate'
import type { WorkbookStore } from '../src/shared/storage/application/createWorkbookStore'
import { SPENDING, browserHarness, forgetCaches } from './fixtures/writeBack'

const DAY = parseCivilDate('2026-11-07')!
const used = new Set<string>()
afterEach(async () => forgetCaches(used))

interface Desk {
  readonly store: WorkbookStore<SpendingBooks>
  readonly reads: ChatReads
  readonly cards: CheckedProposal[]
  ref(kind: string, id: string): string
  propose(steps: readonly { readonly op: string; readonly input: unknown; readonly as?: string }[], allowed?: boolean): ReturnType<typeof proposeChanges>
}

async function desk(): Promise<Desk> {
  const { store } = await browserHarness(used, fakeSpendingDocument('2026-11-07T09:00:00.000Z', 'people', DAY), SPENDING)
  const typed = store as unknown as WorkbookStore<SpendingBooks>
  const reads: ChatReads = { readers: new Map(), aliases: chatAliases(), refs: chatRefs(), anonymising: () => true, mayRead: async () => true }
  const cards: CheckedProposal[] = []
  const proposers = new Map([['spending', spendingProposer(typed)]])
  return {
    store: typed,
    reads,
    cards,
    ref: (kind, id) => reads.refs.recordRef({ app: 'spending', kind, id }),
    propose: (steps, allowed = true) =>
      proposeChanges(
        { app: 'spending', title: 'A title', steps: steps.map((step) => ({ op: step.op, input: JSON.stringify(step.input), as: step.as ?? null })) },
        proposers,
        allowed ? reads : { ...reads, mayRead: async () => false },
        (_app, card) => cards.push(card),
      ),
  }
}

const bookOf = ({ store }: Desk) => store.state.workbook!
const named = (desk: Desk, name: string) => bookOf(desk).categories.find((category) => category.name === name)!
const rowOf = (desk: Desk, payee: string) => bookOf(desk).transactions.find((row) => row.payee === payee)!
const accept = (desk: Desk, at = 0) => spendingAcceptance(desk.store).accept(desk.cards[at]!)

describe('every operation', () => {
  it.each(SPENDING_OPERATIONS.map((operation) => [operation.name, operation] as const))('has an example that passes the checks of the file: %s', async (_name, operation) => {
    const d = await desk()
    const rule = await d.propose([{ op: 'add-rule', input: { row: null, fragment: 'Corner', category: d.ref('category', named(d, 'Groceries').id) } }])
    expect(rule.isError).toBe(false)
    await accept(d)
    const records: Readonly<Record<string, string>> = {
      category: d.ref('category', named(d, 'Rent').id),
      'category-other': d.ref('category', named(d, 'Groceries').id),
      transaction: d.ref('transaction', rowOf(d, 'Harbour bistro').id),
      account: d.ref('account', bookOf(d).accounts[0]!.id),
      rule: d.ref('rule', bookOf(d).rules[0]!.id),
    }
    const input = Object.fromEntries(Object.entries(operation.example).map(([field, value]) => [field, field in operation.refs && typeof value === 'string' ? records[value] : value]))
    const answer = await d.propose([{ op: operation.name, input }])
    expect(answer.text).toContain('The card shows')
    expect(answer.isError).toBe(false)
  })
})

describe('a proposal', () => {
  it('writes nothing until it is accepted, and then one write with one Undo', async () => {
    const d = await desk()
    const groceries = named(d, 'Groceries')
    const before = bookOf(d).rules.length
    const writesBefore = d.store.state.writes.length
    await d.propose([
      { op: 'add-rule', input: { row: null, fragment: 'Corner market', category: d.ref('category', groceries.id) } },
      { op: 'add-rule', input: { row: null, fragment: 'Harbour bistro', category: d.ref('category', named(d, 'Restaurants').id) } },
    ])
    expect(bookOf(d).rules).toHaveLength(before)
    expect(d.store.state.writes).toHaveLength(writesBefore)

    const result = await accept(d)
    expect(result.kind).toBe('done')
    expect(bookOf(d).rules).toHaveLength(before + 2)
    expect(d.store.state.writes).toHaveLength(writesBefore + 1)

    if (result.kind !== 'done') return
    expect((await result.undo()).kind).toBe('undone')
    expect(bookOf(d).rules).toHaveLength(before)
    expect((await result.undo()).kind).toBe('refused')
  })

  it('shows the rows a rule files, in one group, in Kuna’s words', async () => {
    const d = await desk()
    const waiting = rowOf(d, 'Corner market')
    await d.propose([{ op: 'add-rule', input: { row: d.ref('transaction', waiting.id), fragment: null, category: d.ref('category', named(d, 'Coffee').id) } }])
    const [card] = d.cards
    expect(card!.groups.map((group) => [group.verb, group.noun.en.one])).toContainEqual(['add', 'rule'])
    const rule = card!.groups.find((group) => group.noun.en.one === 'rule')!.lines[0]!
    expect(rule.fields).toContainEqual({ name: 'Category', before: null, after: 'Coffee' })
  })

  it('fixes and deletes a rule, with the rows following', async () => {
    const d = await desk()
    await d.propose([{ op: 'add-rule', input: { row: null, fragment: 'Corner market', category: d.ref('category', named(d, 'Coffee').id) } }])
    await accept(d)
    const rule = bookOf(d).rules.at(-1)!
    await d.propose([{ op: 'change-rule', input: { rule: d.ref('rule', rule.id), fragment: null, iban: null, category: d.ref('category', named(d, 'Groceries').id) } }])
    expect((await accept(d, 1)).kind).toBe('done')
    expect(bookOf(d).rules.at(-1)!.category).toBe(named(d, 'Groceries').id)
    await d.propose([{ op: 'delete-rule', input: { rule: d.ref('rule', rule.id) } }])
    expect((await accept(d, 2)).kind).toBe('done')
    expect(bookOf(d).rules.some((other) => other.id === rule.id)).toBe(false)
  })

  it('takes one new category to a card, with a rule into it by its $ name', async () => {
    const d = await desk()
    const add = { op: 'add-category', input: { name: 'Aquarium', kind: 'spending', parent: null } }
    expect((await d.propose([add, add])).text).toContain('one to a card')
    expect(
      (
        await d.propose([
          { ...add, as: '$pets' },
          { op: 'add-rule', input: { row: null, fragment: 'Vet', category: '$pets' } },
        ])
      ).isError,
    ).toBe(false)
    expect((await accept(d)).kind).toBe('done')
    expect(bookOf(d).rules.at(-1)!.category).toBe(named(d, 'Aquarium').id)
  })

  it('refuses a $ name no earlier step made, or a ref of another kind or never handed out', async () => {
    const d = await desk()
    const account = d.ref('account', bookOf(d).accounts[0]!.id)
    for (const category of ['$later', account, 'category-999', '../secrets']) {
      const answer = await d.propose([{ op: 'add-rule', input: { row: null, fragment: 'Vet', category } }])
      expect(answer.isError).toBe(true)
      expect(answer.text).not.toContain(category)
    }
    expect(d.cards).toEqual([])
  })

  it('turns an alias back into what it stands for in what it writes, and marks an IBAN', async () => {
    const d = await desk()
    const alias = d.reads.aliases.aliasOf('Person', 'Ana Horvat')
    const iban = d.reads.aliases.aliasOf('IBAN', 'HR1210010051863000160')
    await d.propose([
      { op: 'add-rule', input: { row: null, fragment: alias, category: d.ref('category', named(d, 'Rent').id) } },
      { op: 'change-account', input: { account: d.ref('account', bookOf(d).accounts[0]!.id), name: null, iban, closed: null } },
    ])
    const lines = d.cards[0]!.groups.flatMap((group) => group.lines)
    expect(lines.some((line) => line.warns)).toBe(true)
    await accept(d)
    expect(bookOf(d).rules.at(-1)!.condition).toEqual({ column: 'counterparty_contains', fragment: 'Ana Horvat' })
    expect(bookOf(d).accounts[0]!.iban).toBe('HR1210010051863000160')
  })

  it('tells the model nothing the card holds, and no name when Kuna refuses it', async () => {
    const d = await desk()
    const answer = await d.propose([{ op: 'add-rule', input: { row: null, fragment: 'Ana Horvat', category: d.ref('category', named(d, 'Rent').id) } }])
    expect(answer.text).not.toContain('Ana Horvat')
    const refused = await d.propose([{ op: 'delete-category', input: { category: d.ref('category', named(d, 'Between my accounts').id), into: d.ref('category', named(d, 'Rent').id) } }])
    expect(refused.isError).toBe(true)
  })

  it('keeps the model’s title as it wrote it, so no real name goes back to the model or into what this browser keeps', async () => {
    const d = await desk()
    d.reads.aliases.aliasOf('Person', 'Ana Horvat')
    const answer = await proposeChanges(
      { app: 'spending', title: 'Rules for Person 1', steps: [{ op: 'set-setting', input: JSON.stringify({ key: COMPANY_OIB_KEY, value: '12345678903' }), as: null }] },
      new Map([['spending', spendingProposer(d.store)]]),
      d.reads,
      (_app, card) => d.cards.push(card),
    )
    expect(answer.isError).toBe(false)
    expect(d.cards[0]!.title).toBe('Rules for Person 1')
  })

  it('needs the yes to read the app', async () => {
    const d = await desk()
    const answer = await d.propose(
      [
        { op: 'delete-rule', input: { rule: 'rule-1' } },
        { op: 'set-setting', input: { key: COMPANY_OIB_KEY, value: '1' } },
      ],
      false,
    )
    expect(answer.isError).toBe(true)
    expect(d.cards).toEqual([])
  })

  it.each([BANK_SYNC_DEPLOYMENT_KEY, 'bank_link_otp', 'kuna-secrets', ''])('can never set %j', async (key) => {
    const d = await desk()
    const answer = await d.propose([{ op: 'set-setting', input: { key, value: 'AKfycbxAttacker' } }])
    expect(answer.isError).toBe(true)
    expect(d.cards).toEqual([])
    expect(bookOf(d).settings.bankSyncDeployment).toBe('')
  })

  it('refuses alone when a record changed before Accept, and the next proposal still goes', async () => {
    const d = await desk()
    const groceries = named(d, 'Groceries')
    await d.propose([{ op: 'change-category', input: { category: d.ref('category', groceries.id), name: 'Food shop', hidden: null } }])
    await d.propose([{ op: 'change-category', input: { category: d.ref('category', groceries.id), name: 'Shop', hidden: null } }])
    await d.propose([{ op: 'change-category', input: { category: d.ref('category', named(d, 'Coffee').id), name: 'Kava', hidden: null } }])
    expect((await accept(d, 0)).kind).toBe('done')
    const stale = await accept(d, 1)
    expect(stale.kind).toBe('refused')
    expect(named(d, 'Food shop')).toBeDefined()
    expect((await accept(d, 2)).kind).toBe('done')
    expect(named(d, 'Kava')).toBeDefined()
  })

  it('gives settings an Undo', async () => {
    const d = await desk()
    expect(SETTING_WRITES.undoable).toBe(true)
    await d.propose([{ op: 'set-setting', input: { key: COMPANY_OIB_KEY, value: '12345678903' } }])
    const result = await accept(d)
    expect(bookOf(d).settings.companyOib).toBe('12345678903')
    if (result.kind === 'done') await result.undo()
    expect(bookOf(d).settings.companyOib).toBe('')
  })
})
