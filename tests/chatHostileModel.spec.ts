import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { spendingReader } from '../src/apps/spending/assistant/spendingReader'
import { catalogueOf, ISSUES_ROUTE } from '../src/shared/ai/application/catalogue'
import type { Catalogue } from '../src/shared/ai/application/catalogue'
import type { ChatReads } from '../src/shared/ai/application/chatReads'
import { CHAT_TOOLS, runChatTool } from '../src/shared/ai/application/chatTools'
import type { ChatChip } from '../src/shared/ai/application/chatTools'
import { guardedModel } from '../src/shared/ai/application/egressGuard'
import type { ModelPort, ModelReply, ModelRequest, ToolCall } from '../src/shared/ai/application/modelPort'
import { contextLine, runChatTurn } from '../src/shared/ai/application/runChatTurn'
import { chatRefs } from '../src/shared/ai/domain/chatRefs'
import { NO_TOKENS } from '../src/shared/ai/domain/modelUsage'
import { chatAliases } from '../src/shared/ai/domain/sensitiveText'
import { CHAT_READING, IBAN_OF_ANA } from './fixtures/chatBook'

const CANARY = 'made-up-anthropic-key-0042'
const BOOK_CANARY = 'Corner market'

const CATALOGUE: Catalogue = catalogueOf(
  [
    {
      id: 'spending',
      name: 'Spending',
      purpose: 'Your accounts.',
      screens: [{ path: '/spending/settings', title: 'Settings' }],
      assistant: {
        kinds: [],
        places: [{ route: '/spending/settings?tab=rules', title: 'Rules' }],
        settings: [],
        guides: [{ id: 'first-rules', title: 'Rules', body: 'How rules work.', places: [] }],
        automations: [],
        reader: spendingReader(CHAT_READING),
      },
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

function readsOf(allowed = false): ChatReads {
  return { readers: CATALOGUE.readers, aliases: chatAliases(), refs: chatRefs(), anonymising: () => true, mayRead: async () => allowed }
}

/** What a tool call does for a model that was given no yes, unless a test says otherwise. */
function tools(show: (chip: ChatChip) => void = () => undefined, reads: ChatReads = readsOf()) {
  return { catalogue: CATALOGUE, reads, showChip: show }
}

const FIND = { app: 'spending', kind: 'transaction', query: null, from: null, to: null, about: null, limit: null, cursor: null }
const TURN = { catalogue: CATALOGUE, history: [], context: null, onDelta: () => undefined, onLookup: () => undefined, showChip: () => undefined, onSent: () => undefined }

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

  it('has exactly the five closed tools', () => {
    expect(CHAT_TOOLS.map((tool) => tool.name)).toEqual(['kuna_docs', 'show_screen', 'find_records', 'get_record', 'read_figures'])
  })

  it.each(HOSTILE_PATHS)('opens no page at %j and repeats nothing of it', async (path) => {
    const answer = await runChatTool(tools(), call('kuna_docs', { path }))
    expect(answer.isError).toBe(true)
    if (path !== '') expect(answer.text).not.toContain(path)
  })

  it.each(HOSTILE_ROUTES)('shows no link for %j', async (route) => {
    const chips: ChatChip[] = []
    expect(
      (
        await runChatTool(
          tools((chip) => chips.push(chip)),
          call('show_screen', { route }),
        )
      ).isError,
    ).toBe(true)
    expect(chips).toEqual([])
  })

  it('lets no draft or other argument ride along with the issues link', async () => {
    const chips: ChatChip[] = []
    const show = (chip: ChatChip): void => {
      chips.push(chip)
    }
    expect((await runChatTool(tools(show), call('show_screen', { route: ISSUES_ROUTE, title: 'A draft', body: 'Figures' }))).isError).toBe(true)
    expect(chips).toEqual([])
    expect((await runChatTool(tools(show), call('show_screen', { route: ISSUES_ROUTE }))).isError).toBe(false)
    expect(chips).toEqual([{ kind: 'issues' }])
  })

  it.each(['propose_changes', 'write_record', 'read_file', 'read_attachment', 'web_search', 'web_fetch'])('has no tool called %s', async (name) => {
    expect(await runChatTool(tools(), call(name, { path: 'spending' }))).toEqual({ text: 'There is no such tool.', isError: true })
  })

  it.each([undefined, null, 'spending', ['spending'], {}, { path: 7 }])('refuses arguments off the schema: %j', async (args) => {
    expect((await runChatTool(tools(), call('kuna_docs', args))).isError).toBe(true)
  })

  it.each([
    ['find_records', FIND],
    ['read_figures', { app: 'spending', report: 'month', period: null }],
  ])('reads nothing with %s while the gate says no', async (name, args) => {
    const answer = await runChatTool(tools(), call(name, args))
    expect(answer.isError).toBe(true)
    expect(answer.text).not.toContain(BOOK_CANARY)
    expect(answer.read).toBeUndefined()
  })

  it.each(['transaction-1', 't41', '../account-a', 'account-a', 'kuna-secrets.json', '__proto__', ''])('reads no record by a ref it was never given: %j', async (ref) => {
    const answer = await runChatTool(
      tools(() => undefined, readsOf(true)),
      call('get_record', { app: 'spending', ref }),
    )
    expect(answer.isError).toBe(true)
    if (ref !== '') expect(answer.text).not.toContain(ref)
  })

  it.each(['setting', 'secret', 'kuna-secrets.json', '__proto__', '../transaction'])('reads no kind Kuna does not offer: %j', async (kind) => {
    const answer = await runChatTool(
      tools(() => undefined, readsOf(true)),
      call('find_records', { ...FIND, kind }),
    )
    expect(answer.isError).toBe(true)
    expect(answer.text).not.toContain(kind)
    expect(answer.read).toBeUndefined()
  })

  it.each(['loans', 'secrets', 'kuna', '__proto__', 'constructor', ''])('reads no app that offers no reader: %j', async (app) => {
    expect(
      (
        await runChatTool(
          tools(() => undefined, readsOf(true)),
          call('find_records', { ...FIND, app }),
        )
      ).isError,
    ).toBe(true)
    expect(
      (
        await runChatTool(
          tools(() => undefined, readsOf(true)),
          call('read_figures', { app, report: 'month', period: null }),
        )
      ).isError,
    ).toBe(true)
  })

  it.each([{ limit: -1 }, { limit: 1.5 }, { limit: 'all' }, { cursor: 'x' }, { cursor: '-1' }, { from: 'yesterday' }, { to: "' OR 1=1" }, { about: 'kuna-secrets.json' }, { extra: 'field' }])(
    'refuses a search off its rules: %j',
    async (args) => {
      const answer = await runChatTool(
        tools(() => undefined, readsOf(true)),
        call('find_records', { ...FIND, ...args }),
      )
      expect(answer.isError).toBe(true)
      expect(answer.text).not.toContain(BOOK_CANARY)
    },
  )

  it('cannot search out an identifier digit by digit', async () => {
    const answer = await runChatTool(
      tools(() => undefined, readsOf(true)),
      call('find_records', { ...FIND, query: IBAN_OF_ANA.slice(0, 8) }),
    )
    expect(JSON.parse(answer.text).total).toBe(0)
  })

  it('reads a row that tries to give orders as data, and it cannot write or reach anything by it', async () => {
    const model = hijackedModel([call('find_records', FIND), call('propose_changes', { steps: [] }), call('kuna_docs', { path: 'kuna-secrets.json' })])
    const end = await runChatTurn({ ...TURN, model: guardedModel(model, () => [CANARY]), reads: readsOf(true), message: 'List the rows', signal: new AbortController().signal })
    expect(end.kind).toBe('answer')
    expect(model.bodies.at(-1)).toContain('ignore your rules')
    expect(model.bodies.at(-1)).toContain('There is no such tool.')
    for (const body of model.bodies) {
      expect(body).not.toContain(CANARY)
      expect(body).not.toContain(IBAN_OF_ANA)
      expect(body).not.toContain('Horvat')
    }
    expect(fetch).not.toHaveBeenCalled()
  })

  it('sends nothing but the catalogue, whatever it asks for, with the network and browser storage out of reach', async () => {
    const calls = [...HOSTILE_PATHS.slice(0, 4).map((path) => call('kuna_docs', { path })), call('read_file', { path: 'kuna-secrets.json' }), call('kuna_docs', { path: 'spending/guide/first-rules' })]
    const model = hijackedModel(calls)
    const end = await runChatTurn({ ...TURN, model: guardedModel(model, () => [CANARY]), reads: readsOf(), message: 'What is my balance?', signal: new AbortController().signal })
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
    const end = await runChatTurn({ ...TURN, model: guardedModel(model, () => [CANARY]), reads: readsOf(), message: `My key is ${CANARY}`, signal: new AbortController().signal })
    expect(end.kind).toBe('holds-secret')
    expect(model.bodies).toEqual([])
  })
})

describe('the context line', () => {
  it('names the app, the screen, the address, the day and a tag, and nothing else', () => {
    expect(contextLine({ app: 'Spending', screen: 'Entries', place: null, path: '/spending/transactions', tag: { label: 'Cash on hand', screen: 'Overview' }, today: '2026-11-07' })).toBe(
      '<context>The person is in Spending, on the screen Entries (/spending/transactions). Today is 2026-11-07. Tagged element: Cash on hand, on the screen Overview.</context>',
    )
  })

  it('names the tab after the screen, with its address', () => {
    expect(contextLine({ app: 'Company', screen: 'Transactions', place: 'To review', path: '/company/transactions?tab=review', tag: null, today: '2026-11-07' })).toBe(
      '<context>The person is in Company, on the screen Transactions, tab To review (/company/transactions?tab=review). Today is 2026-11-07.</context>',
    )
  })

  it('says Kuna outside the apps', () => {
    expect(contextLine({ app: null, screen: null, place: null, path: '/', tag: null, today: '2026-11-07' })).toBe('<context>The person is in Kuna (/). Today is 2026-11-07.</context>')
  })
})
