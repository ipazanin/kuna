import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { spendingAcceptance, spendingProposer } from '../src/apps/spending/assistant/operations/spendingOperations'
import { SETTING_WRITES } from '../src/apps/spending/workbook/application/settingWrites'
import type { SpendingBooks } from '../src/apps/spending/workbook/domain/spendingBooks'
import { BANK_SYNC_DEPLOYMENT_KEY, COMPANY_OIB_KEY } from '../src/apps/spending/workbook/domain/spendingSettings'
import { fakeSpendingDocument } from '../src/apps/spending/workbook/infrastructure/fake/fakeSpending'
import { ATTACHMENT_REF } from '../src/shared/app/assistantOperations'
import type { AppProposer, AssistantOperation, CheckedProposal, ProposalStep } from '../src/shared/app/assistantOperations'
import type { ChatAttachment } from '../src/shared/ai/domain/chatAttachments'
import { proposeChanges } from '../src/shared/ai/application/chatProposals'
import type { ChatReads } from '../src/shared/ai/application/chatReads'
import { chatRefs } from '../src/shared/ai/domain/chatRefs'
import { newPseudonyms } from '../src/shared/privacy/domain/pseudonyms'
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
  const reads: ChatReads = { readers: new Map(), pseudonyms: newPseudonyms(), refs: chatRefs(), anonymising: () => true, persons: () => [], mayRead: async () => true }
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
        [],
        (_app, card) => cards.push(card),
      ),
  }
}

const bookOf = ({ store }: Desk) => store.state.workbook!
const named = (desk: Desk, name: string) => bookOf(desk).categories.find((category) => category.name === name)!
const rowOf = (desk: Desk, payee: string) => bookOf(desk).transactions.find((row) => row.payee === payee)!
const accept = (desk: Desk, at = 0) => spendingAcceptance(desk.store).accept(desk.cards[at]!)

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
    expect((await result.undo!()).kind).toBe('undone')
    expect(bookOf(d).rules).toHaveLength(before)
    expect((await result.undo!()).kind).toBe('refused')
  })

  it('shows the rows a rule files, in one group, in Kuna’s words', async () => {
    const d = await desk()
    const waiting = rowOf(d, 'Corner market')
    await d.propose([{ op: 'add-rule', input: { row: d.ref('transaction', waiting.id), fragment: null, category: d.ref('category', named(d, 'Coffee').id) } }])
    const [card] = d.cards
    expect(card!.groups.map((group) => [group.verb, group.noun.en.one])).toContainEqual(['add', 'rule'])
    const rule = card!.groups.find((group) => group.noun.en.one === 'rule')!.lines[0]!
    expect(rule.label).toBe('Corner market')
    expect(rule.fields).toContainEqual({ name: 'Category', before: null, after: 'Coffee', warns: false })
  })

  it('labels a rule from an IBAN by what it files, warns on that field first, and shows amounts and days as the screens do', async () => {
    const d = await desk()
    const account = bookOf(d).accounts[0]!
    await d.propose([
      {
        op: 'change-account',
        input: { account: d.ref('account', account.id), name: null, kind: null, bank: null, currency: null, opening: null, openedOn: null, iban: 'HR1210010051863000160', closed: 'yes' },
      },
      { op: 'add-entry', input: { account: d.ref('account', account.id), date: '2026-11-03', amount: -12.5, payee: 'Corner market', category: null, note: '' } },
    ])
    const lines = d.cards[0]!.groups.flatMap((group) => group.lines)
    const changed = lines.find((line) => line.label === account.name)!
    expect(changed.fields[0]).toMatchObject({ name: 'IBAN', warns: true })
    expect(changed.fields.slice(1).every((field) => !field.warns)).toBe(true)
    const entry = lines.find((line) => line.label === 'Corner market')!
    expect(entry.fields.find((field) => field.name === 'Amount')?.after).toMatch(/12[.,]50/)
    expect(entry.fields.find((field) => field.name === 'Amount')?.after).not.toBe('-12.50 EUR')
    expect(entry.fields.find((field) => field.name === 'Date')?.after).not.toBe('2026-11-03')
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
    d.reads.pseudonyms.know(['Ana Horvat'])
    const alias = d.reads.pseudonyms.pseudonymised('Ana Horvat')
    const iban = d.reads.pseudonyms.identifierToken('HR1210010051863000160')
    await d.propose([
      { op: 'add-rule', input: { row: null, fragment: alias, category: d.ref('category', named(d, 'Rent').id) } },
      { op: 'change-account', input: { account: d.ref('account', bookOf(d).accounts[0]!.id), name: null, kind: null, bank: null, currency: null, opening: null, openedOn: null, iban, closed: null } },
    ])
    const lines = d.cards[0]!.groups.flatMap((group) => group.lines)
    expect(lines.some((line) => line.fields.some((field) => field.warns))).toBe(true)
    await accept(d)
    expect(bookOf(d).rules.at(-1)!.condition).toEqual({ column: 'counterparty_contains', fragment: 'Ana Horvat' })
    expect(bookOf(d).accounts[0]!.iban).toBe('HR1210010051863000160')
  })

  it('makes a rule from an alias cover every way its person was written', async () => {
    const d = await desk()
    d.reads.pseudonyms.know(['Ana Horvat'])
    d.reads.pseudonyms.pseudonymised('HORVAT ANA')
    const alias = d.reads.pseudonyms.pseudonymised('Ana Horvat')
    const rulesBefore = bookOf(d).rules.length
    await d.propose([{ op: 'add-rule', input: { row: null, fragment: alias, category: d.ref('category', named(d, 'Rent').id) } }])
    await accept(d)
    expect(
      bookOf(d)
        .rules.slice(rulesBefore)
        .map((rule) => rule.condition),
    ).toEqual([
      { column: 'counterparty_contains', fragment: 'Ana Horvat' },
      { column: 'counterparty_contains', fragment: 'HORVAT ANA' },
    ])
  })

  it('writes an ordinary word that only looks like an alias as the model wrote it', async () => {
    const d = await desk()
    d.reads.pseudonyms.know(['Ana Horvat'])
    d.reads.pseudonyms.pseudonymised('Ana Horvat')
    await d.propose([
      { op: 'add-rule', input: { row: null, fragment: 'Osobnu 1', category: d.ref('category', named(d, 'Rent').id) } },
      { op: 'add-rule', input: { row: null, fragment: 'Adresama 1', category: d.ref('category', named(d, 'Rent').id) } },
    ])
    await accept(d)
    expect(
      bookOf(d)
        .rules.slice(-2)
        .map((rule) => rule.condition),
    ).toEqual([
      { column: 'counterparty_contains', fragment: 'Osobnu 1' },
      { column: 'counterparty_contains', fragment: 'Adresama 1' },
    ])
  })

  it('tells the model nothing the card holds, and no name when Kuna refuses it', async () => {
    const d = await desk()
    const answer = await d.propose([{ op: 'add-rule', input: { row: null, fragment: 'Ana Horvat', category: d.ref('category', named(d, 'Rent').id) } }])
    expect(answer.text).not.toContain('Ana Horvat')
    const refused = await d.propose([{ op: 'delete-category', input: { category: d.ref('category', named(d, 'Between my accounts').id), into: d.ref('category', named(d, 'Rent').id) } }])
    expect(refused.isError).toBe(true)
  })

  it('shows the person every refusal the model reads, with known people under their alias', async () => {
    const d = await desk()
    d.reads.pseudonyms.know(['Ana Horvat'])
    const refused = await d.propose([{ op: 'delete-category', input: { category: d.ref('category', named(d, 'Between my accounts').id), into: d.ref('category', named(d, 'Rent').id) } }])
    expect(refused.isError).toBe(true)
    expect(refused.read).toEqual({ kind: 'refusal', app: 'spending' })
    expect(refused.text).not.toContain('Ana Horvat')
  })

  it('keeps the model’s title as it wrote it, so no real name goes back to the model or into what this browser keeps', async () => {
    const d = await desk()
    d.reads.pseudonyms.know(['Ana Horvat'])
    const answer = await proposeChanges(
      { app: 'spending', title: 'Rules for Person 1', steps: [{ op: 'set-setting', input: JSON.stringify({ key: COMPANY_OIB_KEY, value: '12345678903' }), as: null }] },
      new Map([['spending', spendingProposer(d.store)]]),
      d.reads,
      [],
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
    await d.propose([{ op: 'change-category', input: { category: d.ref('category', groceries.id), name: 'Food shop', group: null, colour: null, hidden: null } }])
    await d.propose([{ op: 'change-category', input: { category: d.ref('category', groceries.id), name: 'Shop', group: null, colour: null, hidden: null } }])
    await d.propose([{ op: 'change-category', input: { category: d.ref('category', named(d, 'Coffee').id), name: 'Kava', group: null, colour: null, hidden: null } }])
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
    if (result.kind === 'done') await result.undo!()
    expect(bookOf(d).settings.companyOib).toBe('')
  })
})

describe('a proposal of another app', () => {
  const STATEMENT: ChatAttachment = { id: 'a1', kind: 'sheet', name: 'Statement of Ana Horvat.xlsx', bytes: new Uint8Array([1, 2, 3]), original: new Blob(), pages: 1, sent: null }
  const IMPORT: AssistantOperation = {
    name: 'import-statement',
    about: 'Imports an attached statement.',
    input: { type: 'object', properties: { file: { type: 'string' } }, required: ['file'], additionalProperties: false },
    refs: { file: ATTACHMENT_REF },
    creates: null,
    alone: false,
    example: { file: 'a1' },
  }

  function stubProposer(readsBooks: boolean, seen: ProposalStep[][]): AppProposer {
    return {
      operations: [IMPORT],
      readsBooks,
      check: async (title, steps) => {
        seen.push([...steps])
        return { title, count: 1, groups: [], outside: [], undoable: true, held: {} }
      },
    }
  }

  const reads: ChatReads = { readers: new Map(), pseudonyms: newPseudonyms(), refs: chatRefs(), anonymising: () => true, persons: () => [], mayRead: async () => false }
  const propose = (proposer: AppProposer, file: string) =>
    proposeChanges({ app: 'kuna', title: 'Import', steps: [{ op: 'import-statement', input: JSON.stringify({ file }), as: null }] }, new Map([['kuna', proposer]]), reads, [STATEMENT], () => undefined)

  it('hands the operation the attached file itself, by its id', async () => {
    const seen: ProposalStep[][] = []
    const answer = await propose(stubProposer(false, seen), 'a1')
    expect(answer.isError).toBe(false)
    expect(seen[0]![0]!.input['file']).toBe(STATEMENT)
  })

  it.each(['a2', 'Statement of Ana Horvat.xlsx', '../a1'])('refuses %j, which is not a file attached to this chat', async (file) => {
    const seen: ProposalStep[][] = []
    const answer = await propose(stubProposer(false, seen), file)
    expect(answer.isError).toBe(true)
    expect(answer.text).not.toContain(file)
    expect(seen).toEqual([])
  })

  it('turns an alias back into the name inside a list of rows, as a statement transcribes them', async () => {
    const seen: ProposalStep[][] = []
    const anonymised: ChatReads = { ...reads, pseudonyms: newPseudonyms() }
    anonymised.pseudonyms.know(['Ana Horvat'])
    const alias = anonymised.pseudonyms.pseudonymised('Ana Horvat')
    const ROWS: AssistantOperation = {
      ...IMPORT,
      input: {
        type: 'object',
        properties: { file: { type: 'string' }, rows: { type: 'array', items: { type: 'object', properties: { payee: { type: 'string' } }, required: ['payee'], additionalProperties: false } } },
        required: ['file', 'rows'],
        additionalProperties: false,
      },
    }
    const proposer: AppProposer = { ...stubProposer(false, seen), operations: [ROWS] }
    const input = JSON.stringify({ file: 'a1', rows: [{ payee: `${alias}, rent` }] })
    await proposeChanges({ app: 'kuna', title: 'Import', steps: [{ op: 'import-statement', input, as: null }] }, new Map([['kuna', proposer]]), anonymised, [STATEMENT], () => undefined)
    expect(seen[0]![0]!.input['rows']).toEqual([{ payee: 'Ana Horvat, rent' }])
  })

  it('asks for no yes to read when the proposer reads no books, and still needs it when it does', async () => {
    expect((await propose(stubProposer(false, []), 'a1')).isError).toBe(false)
    const seen: ProposalStep[][] = []
    expect((await propose(stubProposer(true, seen), 'a1')).isError).toBe(true)
    expect(seen).toEqual([])
  })
})
