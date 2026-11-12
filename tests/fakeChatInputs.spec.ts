// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { registerFakeAssetsChat } from '../src/apps/assets/assistant/infrastructure/fake/fakeAssetsChat'
import { registerFakeCompanyChat } from '../src/apps/company/assistant/infrastructure/fake/fakeCompanyChat'
import { registerFakeTripChat } from '../src/apps/company/packs/hr-doo/assistant/infrastructure/fake/fakeTripChat'
import { registerFakeInvestmentsChat } from '../src/apps/investments/assistant/infrastructure/fake/fakeInvestmentsChat'
import { registerFakeLoansChat } from '../src/apps/loans/assistant/infrastructure/fake/fakeLoansChat'
import { registerFakeSpendingChat } from '../src/apps/spending/assistant/infrastructure/fake/fakeSpendingChat'
import type { ProposeInput } from '../src/shared/ai/application/chatProposals'
import { CHAT_TOOLS } from '../src/shared/ai/application/chatTools'
import type { ModelRequest, ModelTurn, ToolCall } from '../src/shared/ai/application/modelPort'
import { schemaProblems } from '../src/shared/ai/domain/strictSchema'
import { fakeChatReply } from '../src/shared/ai/infrastructure/fake/fakeChatReply'
import { words as chatWords } from '../src/shared/ai/presentation/words'
import { registerFakeKunaChat } from '../src/shell/assistant/infrastructure/fake/fakeKunaChat'
import { APP_OPERATIONS } from './fixtures/appOperations'

/** The fake chats in the order the fake build registers them: the apps as main.ts installs them, the pack's after Company's, then Kuna's own. */
registerFakeCompanyChat()
registerFakeTripChat()
registerFakeLoansChat()
registerFakeInvestmentsChat()
registerFakeAssetsChat()
registerFakeSpendingChat()
registerFakeKunaChat()

/** What find_records answers in this spec, by app, kind and set, holding what each fake chat looks for. */
const RECORDS: Readonly<Record<string, readonly object[]>> = {
  'spending/transaction': [
    { ref: 'transaction-1', payee: 'Corner market', category: 'category-1', amount: { ref: 'amount-1' } },
    { ref: 'transaction-2', payee: 'Person 1', amount: { ref: 'amount-2' } },
  ],
  'spending/transaction/waiting': [{ ref: 'transaction-3', payee: 'City pharmacy' }],
  'spending/category': [
    { ref: 'category-1', name: 'Groceries', kind: 'spending' },
    { ref: 'category-2', name: 'Household goods', kind: 'spending' },
    { ref: 'category-3', name: 'Pet food', kind: 'spending' },
    { ref: 'category-4', name: 'Pharmacy', kind: 'spending' },
  ],
  'spending/account': [
    { ref: 'account-1', name: 'OTP', kind: 'bank', bank: 'otp', currency: 'EUR', rowsFrom: 'bank-link' },
    { ref: 'account-2', name: 'Revolut', kind: 'bank', bank: 'revolut', currency: 'EUR', rowsFrom: 'by-hand' },
  ],
  'company/ledger-row/waiting': [
    { ref: 'ledger-row-1', counterparty: 'GADGET CORNER' },
    { ref: 'ledger-row-2', counterparty: 'Harbour bistro' },
  ],
  'company/category': [
    { ref: 'category-1', label: 'Equipment' },
    { ref: 'category-2', label: 'Office supplies' },
    { ref: 'category-3', label: 'AI services' },
    { ref: 'category-4', label: 'Software subscriptions' },
    { ref: 'category-5', label: 'Client meals' },
  ],
  'company/rule': [{ ref: 'rule-1' }, { ref: 'rule-2' }],
  'company/client': [{ ref: 'client-1' }],
  'company/account': [{ ref: 'account-1', label: 'Main account' }],
  'company/hr-doo.trip': [{ ref: 'hr-doo.trip-1', number: '3/2026' }],
  'loans/bank-loan': [{ ref: 'bank-loan-1' }],
  'investments/investment-account': [{ ref: 'investment-account-1' }],
  'investments/instrument': [{ ref: 'instrument-1' }],
  'assets/asset': [{ ref: 'asset-1' }],
}

const REVOLUT_CELLS = [
  ['Type', 'Started Date', 'Completed Date', 'Description', 'Amount', 'State'],
  ['CARD_PAYMENT', '2026-11-01 10:00:00', '2026-11-02 10:00:00', 'Corner market', '-12.50', 'COMPLETED'],
]

/** A tool's answer as the fake chats read it, over the records above or a flow's own. */
function answerOf(call: ToolCall, records: Readonly<Record<string, readonly object[]>>): string {
  const args = call.args as Readonly<Record<string, unknown>>
  switch (call.name) {
    case 'find_records':
      return JSON.stringify({ records: records[[args['app'], args['kind'], args['only']].filter((part) => part !== null).join('/')] ?? [] })
    case 'read_figures':
      return JSON.stringify({
        figures: [
          { ref: 'figure-1', label: 'value' },
          { ref: 'figure-2', label: 'total gain' },
        ],
      })
    case 'read_attachment':
      return JSON.stringify({ rows: REVOLUT_CELLS })
    case 'match_records':
      return args['kind'] === 'receipt'
        ? JSON.stringify({ receipts: [{ match: 'ready', payments: [{ ref: 'transaction-1', date: '2026-11-02', amount: { ref: 'amount-1' } }] }] })
        : JSON.stringify({ matches: [{ row: 1, match: 'same' }] })
    case 'read_build_up':
      return JSON.stringify({ figure: { label: 'Profit tax', amount: '[amount-1]', steps: [] }, ruleRefs: { profit: 'tax-rule-1' } })
    default:
      return 'The card shows the changes.'
  }
}

/** What is wrong with a call the fake chat made, as the chat's tools would refuse it before reading anything: its tool's schema, and for a proposal each step's operation schema. */
function callProblems(call: ToolCall): readonly string[] {
  const tool = CHAT_TOOLS.find((candidate) => candidate.name === call.name)
  if (tool === undefined) return [`${call.name} is no tool`]
  const problems = schemaProblems(call.args, tool.input).map((problem) => `${call.name}: ${problem}`)
  if (call.name !== 'propose_changes' || problems.length > 0) return problems
  const { app, steps } = call.args as ProposeInput
  const operations = APP_OPERATIONS.get(app) ?? []
  return steps.flatMap((step) => {
    const operation = operations.find((candidate) => candidate.name === step.op)
    if (operation === undefined) return [`${app} has no operation ${step.op}`]
    return schemaProblems(JSON.parse(step.input), operation.input).map((problem) => `${step.op}: ${problem}`)
  })
}

/** One thing a person asks, with the context lines and earlier messages it comes after, and the operations its card should propose. */
interface Flow {
  readonly name: string
  readonly said: readonly string[]
  readonly context?: string
  readonly records?: Readonly<Record<string, readonly object[]>>
  readonly proposes: readonly string[]
}

const IN_COMPANY = '<context>The person is in Company: Transactions (/company/transactions). Today is 2026-11-12.</context>'
const PHOTO = '<context>Attached: a1 (photo).</context>'
const CSV = '<context>Attached: a1 (csv, 2 rows).</context>'
const SORT_JOB = 'Sort the rows waiting on To review. Suggest a category for each.'
const COMPANY_SORT = 'Suggest categories for the rows waiting'
const GO_ON = chatWords.chat.goOn

const FLOWS: readonly Flow[] = [
  { name: 'spending figures', said: ['How much did I spend this month?'], proposes: [] },
  { name: 'spending rule from the latest rows', said: ['Sort my latest rows'], proposes: ['add-rule'] },
  { name: 'spending sorting job', said: [SORT_JOB], proposes: ['add-category'] },
  { name: 'spending sorting job, go on', said: [SORT_JOB, GO_ON], proposes: ['add-rule'] },
  { name: 'spending close an account', said: ['Close the old account'], proposes: ['change-account'] },
  { name: 'spending pasted statement', said: ['Import this statement'], proposes: ['import-statement', 'import-statement'] },
  { name: 'spending copied statement', said: ['Transcribe the statement'], proposes: ['import-statement'] },
  { name: 'spending Revolut file', said: ['Bring the Revolut export in'], context: CSV, proposes: ['import-statement'] },
  { name: 'spending match rows', said: ['Check these rows'], proposes: [] },
  { name: 'spending biggest spends', said: ['What were my biggest spends last month?'], proposes: [] },
  { name: 'spending receipt', said: ['Read the receipt'], context: PHOTO, proposes: ['add-receipt'] },
  {
    name: 'spending receipt with no pet food category',
    said: ['Read the receipt'],
    context: PHOTO,
    records: { ...RECORDS, 'spending/category': RECORDS['spending/category']!.slice(0, 2) },
    proposes: ['add-category'],
  },
  { name: 'spending receipt on the entry tagged', said: ['Read the receipt'], context: `${PHOTO}\nTagged element: the transaction transaction-1 of spending`, proposes: ['add-receipt'] },
  { name: 'spending receipt on a payment picked', said: ['Put the receipt on Harbour bistro'], context: PHOTO, proposes: ['add-receipt'] },
  { name: 'spending cash receipt with a new cash account', said: ['I had €50'], context: PHOTO, proposes: ['add-account', 'add-receipt'] },
  {
    name: 'spending cash receipt on the cash account',
    said: ['Read the cash receipt'],
    context: PHOTO,
    records: { ...RECORDS, 'spending/account': [{ ref: 'account-3', name: 'Cash', kind: 'cash', currency: 'EUR' }] },
    proposes: ['add-receipt'],
  },
  { name: 'spending card receipt', said: ['No, by card'], context: PHOTO, proposes: ['add-receipt'] },
  { name: 'spending purse', said: ['Add a cash purse'], proposes: ['add-account'] },
  { name: 'spending split', said: ['Split the latest spend'], proposes: ['split-entry'] },
  { name: 'spending rules guide', said: ['How do rules work?'], proposes: [] },
  { name: 'company sorting', said: [COMPANY_SORT], context: IN_COMPANY, proposes: ['file-row'] },
  {
    name: 'company sorting with no row it is sure of',
    said: [COMPANY_SORT],
    context: IN_COMPANY,
    records: { ...RECORDS, 'company/ledger-row/waiting': [{ ref: 'ledger-row-2', counterparty: 'Harbour bistro' }] },
    proposes: ['add-category'],
  },
  { name: 'company sorting, go on to the category', said: [COMPANY_SORT, GO_ON], context: IN_COMPANY, proposes: ['add-category'] },
  { name: 'company sorting, go on to the rule', said: [COMPANY_SORT, GO_ON, GO_ON], context: IN_COMPANY, proposes: ['add-rule'] },
  { name: 'company invoice', said: ['Make an invoice'], context: IN_COMPANY, proposes: [] },
  { name: 'company currency', said: ['Keep the books in dollars'], context: IN_COMPANY, proposes: ['set-setting'] },
  { name: 'company rule first', said: ['Always file Laptop Store under office supplies'], context: IN_COMPANY, proposes: ['add-rule'] },
  { name: 'company rule moved', said: ['Try the second rule first'], context: IN_COMPANY, proposes: ['change-rule'] },
  { name: 'company category', said: ['Add a category for training'], context: IN_COMPANY, proposes: ['add-category'] },
  { name: 'company merge', said: ['Merge AI services into software'], context: IN_COMPANY, proposes: ['delete-category'] },
  { name: 'company pasted statement', said: ['Import this statement'], context: IN_COMPANY, proposes: ['import-statement'] },
  { name: 'company copied statement', said: ['Transcribe the statement'], context: IN_COMPANY, proposes: ['import-statement'] },
  { name: 'company build-up', said: ['Explain this figure'], context: `${IN_COMPANY.replace('</context>', ' Tagged element: build-up-1.</context>')}`, proposes: [] },
  { name: 'company trip cost', said: ['Add 18 euros of parking I paid to travel order 3/2026'], context: IN_COMPANY, proposes: ['add-trip-cost'] },
  { name: 'loans offer', said: ['Offer from the bank'], proposes: ['add-offer'] },
  { name: 'loans extra payment', said: ['Extra payment on the loan'], proposes: ['add-extra-payment'] },
  { name: 'loans contract', said: ['Contract for the car loan'], proposes: ['add-bank-loan'] },
  { name: 'investments buy', said: ['Buy one unit'], proposes: ['add-trade'] },
  { name: 'investments sell', said: ['Sell a million units'], proposes: ['add-trade'] },
  { name: 'investments copied deposits', said: ['Copy the deposits again'], proposes: ['import-transcribed'] },
  { name: 'investments file', said: ['Copy the deposits from the file'], context: CSV, proposes: ['import-transcribed'] },
  { name: 'investments look-alike answered', said: ['It is another record'], context: CSV, proposes: ['import-transcribed'] },
  { name: 'investments portfolio', said: ['What is my portfolio worth?'], proposes: [] },
  { name: 'assets valuation', said: ['Valuation of the flat'], proposes: ['add-valuation'] },
  { name: 'kuna theme', said: ['Use the dark look'], proposes: ['set-theme'] },
  { name: 'feature request', said: ['How do I ask for a feature?'], proposes: [] },
  { name: 'attached sheet', said: ['Read the file'], context: '<context>Attached: a1 (sheet, 3 rows).</context>', proposes: [] },
]

const TOKENS = { input: 0, cacheRead: 0, cacheWrite: 0, output: 0 }

/** Walks the fake chat through one flow as the chat loop would, answering each lookup, and gives every call it made. */
function callsOf(flow: Flow): readonly ToolCall[] {
  const said: ModelTurn[] = flow.said.map((text, at) => ({
    role: 'user',
    parts: [...(at === 0 && flow.context !== undefined ? [{ kind: 'text' as const, text: flow.context }] : []), { kind: 'text', text }],
  }))
  const turns = [...said]
  const calls: ToolCall[] = []
  for (let round = 0; round < 8; round++) {
    const request: ModelRequest = { system: [], turns, tools: CHAT_TOOLS, effort: 'low' }
    const reply = fakeChatReply(request, TOKENS, false)
    if (reply.kind !== 'tool-calls') return calls
    calls.push(...reply.calls)
    turns.push({ role: 'assistant', calls: reply.calls, raw: reply.raw })
    turns.push({ role: 'tool-results', results: reply.calls.map((call) => ({ callId: call.id, text: answerOf(call, flow.records ?? RECORDS), parts: [], isError: false })) })
  }
  throw new Error(`${flow.name} never answers.`)
}

const ALL_CALLS = FLOWS.map((flow) => [flow, callsOf(flow)] as const)

function proposedOps(calls: readonly ToolCall[]): readonly string[] {
  return calls.flatMap((call) => (call.name === 'propose_changes' ? (call.args as ProposeInput).steps.map((step) => step.op) : []))
}

/** The fake chats' sources, each file under a fake folder that builds a step of a proposal. */
const FAKE_SOURCES = [
  'src/apps/spending/assistant/infrastructure/fake/fakeSetUpChat.ts',
  'src/apps/spending/assistant/infrastructure/fake/fakeImportsChat.ts',
  'src/apps/spending/assistant/infrastructure/fake/fakeReceiptsChat.ts',
  'src/apps/spending/assistant/infrastructure/fake/fakeSplitsChat.ts',
  'src/apps/company/assistant/infrastructure/fake/fakeCompanyChat.ts',
  'src/apps/company/packs/hr-doo/assistant/infrastructure/fake/fakeTripChat.ts',
  'src/apps/loans/assistant/infrastructure/fake/fakeLoansChat.ts',
  'src/apps/investments/assistant/infrastructure/fake/fakeInvestmentsChat.ts',
  'src/apps/assets/assistant/infrastructure/fake/fakeAssetsChat.ts',
  'src/shell/assistant/infrastructure/fake/fakeKunaChat.ts',
]

describe('the fake chat', () => {
  it.each(ALL_CALLS.map(([flow, calls]) => [flow.name, flow, calls] as const))('calls each tool with an input its schema and the operation take: %s', (_name, flow, calls) => {
    expect(calls.flatMap(callProblems)).toEqual([])
    expect(proposedOps(calls)).toEqual(flow.proposes)
  })

  it('walks every operation the fake chats build a step of', () => {
    const built = new Set(FAKE_SOURCES.flatMap((file) => [...readFileSync(file, 'utf8').matchAll(/proposedStep\(\s*[^,]+,\s*'([a-z-]+)'/g)].map((match) => match[1]!)))
    const walked = new Set(ALL_CALLS.flatMap(([, calls]) => proposedOps(calls)))
    expect([...built].filter((op) => !walked.has(op))).toEqual([])
    expect(built.size).toBeGreaterThanOrEqual(15)
  })

  it('builds every step of a proposal from its operation, so a field the operation gains reaches it through the example', () => {
    const handWritten = FAKE_SOURCES.filter((file) => /op: '[a-z-]+',\s*input:/.test(readFileSync(file, 'utf8')))
    expect(handWritten).toEqual([])
  })
})
