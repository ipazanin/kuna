import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { catalogueOf, ISSUES_ROUTE } from '../src/shared/ai/application/catalogue'
import type { Catalogue } from '../src/shared/ai/application/catalogue'
import { CHAT_TOOLS, runChatTool } from '../src/shared/ai/application/chatTools'
import type { ChatChip } from '../src/shared/ai/application/chatTools'
import { guardedModel } from '../src/shared/ai/application/egressGuard'
import type { ModelPort, ModelReply, ModelRequest, ToolCall } from '../src/shared/ai/application/modelPort'
import { contextLine, runChatTurn } from '../src/shared/ai/application/runChatTurn'
import { NO_TOKENS } from '../src/shared/ai/domain/modelUsage'

const CANARY = 'made-up-anthropic-key-0042'
const BOOK_CANARY = 'Made-up payee 7731'

const CATALOGUE: Catalogue = catalogueOf(
  [
    {
      id: 'spending',
      name: 'Spending',
      purpose: 'Your accounts.',
      screens: [{ path: '/spending/settings', title: 'Settings' }],
      assistant: { kinds: [], places: [{ route: '/spending/settings?tab=rules', title: 'Rules' }], settings: [], guides: [{ id: 'first-rules', title: 'Rules', body: 'How rules work.', places: [] }] },
    },
  ],
  [{ path: '/settings', title: 'Kuna settings' }],
)

const HOSTILE_PATHS = [
  '../',
  '../../kuna-secrets.json',
  'kuna-secrets.json',
  'kuna.secret.anthropic',
  'kuna-investments-keys-1',
  'spending/../kuna',
  '/spending',
  'file:///etc/passwd',
  'https://example.com/',
  '',
  'spending/record/1',
  '__proto__',
  'constructor',
]
const HOSTILE_ROUTES = [
  'https://example.com/',
  '//example.com',
  'javascript:alert(1)',
  '/spending/settings?tab=rules&then=https://example.com',
  '/spending/account?account=1',
  '/gallery',
  '../settings',
  '',
  'issues?title=x',
  'https://github.com/ipazanin/kuna/issues/new?title=x',
]

function call(name: string, args: unknown): ToolCall {
  return { id: 'call', name, args }
}

/** A hijacked model: it asks for one call after another, and answers once it has asked for them all. */
function hijackedModel(calls: readonly ToolCall[]): ModelPort & { readonly bodies: string[] } {
  const bodies: string[] = []
  let round = 0
  return {
    bodies,
    model: { name: 'hostile', price: null },
    readsPdf: false,
    async send(request: ModelRequest): Promise<ModelReply> {
      bodies.push(JSON.stringify(request))
      const next = calls[round]
      round += 1
      return next === undefined ? { kind: 'answer', text: 'done', raw: [], tokens: NO_TOKENS } : { kind: 'tool-calls', calls: [next], raw: [next], tokens: NO_TOKENS }
    },
  }
}

describe('a chat run by a hostile model', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        throw new Error('A chat tool asked the network.')
      }),
    )
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('A chat tool read browser storage.')
      },
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('has exactly the two closed tools', () => {
    expect(CHAT_TOOLS.map((tool) => tool.name)).toEqual(['kuna_docs', 'show_screen'])
  })

  it.each(HOSTILE_PATHS)('opens no page at %j and repeats nothing of it', (path) => {
    const answer = runChatTool(CATALOGUE, call('kuna_docs', { path }), () => undefined)
    expect(answer.isError).toBe(true)
    if (path !== '') expect(answer.text).not.toContain(path)
  })

  it.each(HOSTILE_ROUTES)('shows no link for %j', (route) => {
    const chips: ChatChip[] = []
    expect(runChatTool(CATALOGUE, call('show_screen', { route }), (chip) => chips.push(chip)).isError).toBe(true)
    expect(chips).toEqual([])
  })

  it('lets no draft or other argument ride along with the issues link', () => {
    const chips: ChatChip[] = []
    const show = (chip: ChatChip): void => {
      chips.push(chip)
    }
    expect(runChatTool(CATALOGUE, call('show_screen', { route: ISSUES_ROUTE, title: 'A draft', body: 'Figures' }), show).isError).toBe(true)
    expect(chips).toEqual([])
    expect(runChatTool(CATALOGUE, call('show_screen', { route: ISSUES_ROUTE }), show).isError).toBe(false)
    expect(chips).toEqual([{ kind: 'issues' }])
  })

  it.each(['find_records', 'get_record', 'read_figures', 'propose_changes', 'read_file', 'read_attachment', 'web_search', 'web_fetch'])('has no tool called %s', (name) => {
    expect(runChatTool(CATALOGUE, call(name, { path: 'spending' }), () => undefined)).toEqual({ text: 'There is no such tool.', isError: true })
  })

  it.each([undefined, null, 'spending', ['spending'], {}, { path: 7 }])('refuses arguments off the schema: %j', (args) => {
    expect(runChatTool(CATALOGUE, call('kuna_docs', args), () => undefined).isError).toBe(true)
  })

  it('sends nothing but the catalogue, whatever it asks for, with the network and browser storage out of reach', async () => {
    const calls = [...HOSTILE_PATHS.slice(0, 4).map((path) => call('kuna_docs', { path })), call('read_file', { path: 'kuna-secrets.json' }), call('kuna_docs', { path: 'spending/guide/first-rules' })]
    const model = hijackedModel(calls)
    const end = await runChatTurn({
      model: guardedModel(model, () => [CANARY]),
      catalogue: CATALOGUE,
      history: [],
      context: null,
      message: 'What is my balance?',
      signal: new AbortController().signal,
      onDelta: () => undefined,
      onLookup: () => undefined,
      showChip: () => undefined,
    })
    expect(end.kind).toBe('answer')
    expect(model.bodies.at(-1)).toContain('How rules work.')
    for (const body of model.bodies) {
      expect(body).not.toContain(CANARY)
      expect(body).not.toContain(BOOK_CANARY)
    }
    expect(fetch).not.toHaveBeenCalled()
  })

  it('stops a message that holds a stored key before it leaves', async () => {
    const model = hijackedModel([])
    const end = await runChatTurn({
      model: guardedModel(model, () => [CANARY]),
      catalogue: CATALOGUE,
      history: [],
      context: null,
      message: `My key is ${CANARY}`,
      signal: new AbortController().signal,
      onDelta: () => undefined,
      onLookup: () => undefined,
      showChip: () => undefined,
    })
    expect(end.kind).toBe('holds-secret')
    expect(model.bodies).toEqual([])
  })
})

describe('the context line', () => {
  it('names the app, the screen, the address and a tag, and nothing else', () => {
    expect(contextLine({ app: 'Spending', screen: 'Entries', place: null, path: '/spending/transactions', tag: { label: 'Cash on hand', screen: 'Overview' } })).toBe(
      '<context>The person is in Spending, on the screen Entries (/spending/transactions). Tagged element: Cash on hand, on the screen Overview.</context>',
    )
  })

  it('names the tab after the screen, with its address', () => {
    expect(contextLine({ app: 'Company', screen: 'Transactions', place: 'To review', path: '/company/transactions?tab=review', tag: null })).toBe(
      '<context>The person is in Company, on the screen Transactions, tab To review (/company/transactions?tab=review).</context>',
    )
  })

  it('says Kuna outside the apps', () => {
    expect(contextLine({ app: null, screen: null, place: null, path: '/', tag: null })).toBe('<context>The person is in Kuna (/).</context>')
  })
})
