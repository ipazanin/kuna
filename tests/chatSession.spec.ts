// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AppProposer } from '../src/shared/app/assistantOperations'
import type { Catalogue } from '../src/shared/ai/application/catalogue'
import type { ModelPort, ModelReply, ModelRequest } from '../src/shared/ai/application/modelPort'
import { spendingReader } from '../src/apps/spending/assistant/spendingReader'
import type { ChatProposal, PromptFile } from '../src/shared/ai/presentation/chatSession'
import type { ChatElementAbout } from '../src/shared/ai/domain/chatElement'
import { NOTHING_TAGGED } from '../src/shared/ai/application/runChatTurn'
import { moneyFromCents } from '../src/shared/money/money'
import { CHAT_BOOK, CHAT_PERSONS, CHAT_READING, IBAN_OF_ANA } from './fixtures/chatBook'

const port = vi.hoisted(() => ({ current: null as ModelPort | null }))
vi.mock('../src/shared/ai/application/modelAccess', () => ({ modelPort: async () => port.current, keyKept: () => true }))
vi.mock('../src/shared/ai/presentation/imagePartOf', () => ({
  imagePartOf: async () => ({ kind: 'image', mediaType: 'image/jpeg', base64: btoa('jpeg'), width: 1092, height: 1092 }),
}))
vi.mock('../src/shared/secrets/presentation/pageSecrets', async () => {
  const { ref } = await import('vue')
  return { useSecretsChanged: () => ref(0) }
})

const {
  allowThisChat,
  attachFiles,
  chatAllowed,
  chatPromptFiles,
  promptFileNotes,
  promptFilesCost,
  removePromptFile,
  chatFigure,
  chatGoingOn,
  chatLines,
  chatSpent,
  chatStatus,
  clearChat,
  sendChatFrom,
  sendChatMessage,
  sendTask,
  settleProposal,
  shownOnScreen,
  startChatWith,
  stopChatMessage,
  undoProposal,
} = await import('../src/shared/ai/presentation/chatSession')
const { allowAssist, assistAllowed, pickProvider, pickModel, switchAnonymise } = await import('../src/shared/ai/application/assistSettings')
const { words } = await import('../src/shared/ai/presentation/words')
const { providerInUse } = await import('../src/shared/ai/presentation/aiProvider')
const { chatElement, chatOpen, chatRequest, closeChat, openChatAbout, removeChatElement, takeChatRequest } = await import('../src/shared/ai/presentation/chatDock')

const CATALOGUE: Catalogue = {
  system: 'Be Kuna.',
  pages: new Map([['spending', 'The Spending page.']]),
  routes: new Map([['/spending', 'Spending: Overview']]),
  places: new Map([['/spending/transactions?tab=review', 'To review']]),
  placeParams: new Map(),
  readers: new Map([['spending', { name: 'Spending', reader: spendingReader(CHAT_READING) }]]),
  proposers: new Map(),
  persons: () => CHAT_PERSONS,
}
const knowledge = async (): Promise<Catalogue> => CATALOGUE
const TOKENS = { input: 1000, cacheRead: 0, cacheWrite: 0, output: 1000 }
const CONTEXT = { app: 'Spending', screen: 'Entries', path: '/spending/transactions', query: {}, element: null, today: '2026-11-07', setUp: [] }
const READ_ROWS = { app: 'spending', kind: 'transaction', query: null, from: null, to: null, refs: [], filters: [], sort: [], fields: [], only: null, limit: null, cursor: null }
const lookup = (name: string, args: unknown, id = 'call'): ModelReply => ({ kind: 'tool-calls', calls: [{ id, name, args }], raw: [], tokens: TOKENS })

function scripted(
  replies: readonly (ModelReply | ((request: ModelRequest) => Promise<ModelReply>))[],
  price = { inputPerMillion: 2, cacheReadPerMillion: 0.1, cacheWritePerMillion: 2.5, outputPerMillion: 10 } as ModelPort['model']['price'],
): ModelPort & { readonly requests: ModelRequest[] } {
  const requests: ModelRequest[] = []
  let at = 0
  return {
    requests,
    model: { name: 'Fake', price },
    readsPdf: false,
    async send(request) {
      requests.push(request)
      const reply = replies[at]!
      at += 1
      return typeof reply === 'function' ? reply(request) : reply
    },
  }
}

const answer = (text: string): ModelReply => ({ kind: 'answer', text, raw: [{ text }], tokens: TOKENS })

/** A file as a picker gives it, with the bytes a browser reads back. */
function picked(name: string, bytes: Uint8Array<ArrayBuffer>, type = ''): File {
  const file = new File([bytes], name, { type })
  Object.defineProperty(file, 'arrayBuffer', { value: async () => bytes.slice().buffer })
  return file
}

const statementPdf = (): File => picked('Statement October.pdf', new Uint8Array(readFileSync(join(import.meta.dirname, 'fixtures/documents/statement-ties.pdf'))), 'application/pdf')

beforeEach(() => {
  clearChat()
  localStorage.clear()
  allowAssist('anthropic', false)
  allowAssist('openai', false)
  pickProvider('anthropic')
})

describe('a chat in memory', () => {
  it('keeps going from the last answer, with the context only when it changed', async () => {
    const model = scripted([answer('One'), answer('Two'), answer('Three')])
    port.current = model
    await sendChatMessage('First', CONTEXT, knowledge)
    await sendChatMessage('Second', CONTEXT, knowledge)
    await sendChatMessage('Third', { ...CONTEXT, app: 'Loans', screen: 'Overview', path: '/loans' }, knowledge)

    expect(chatLines.map((line) => line.text)).toEqual(['First', 'One', 'Second', 'Two', 'Third', 'Three'])
    const textOf = (request: ModelRequest) => {
      const last = request.turns.at(-1)!
      return last.role === 'user' ? last.parts.map((part) => (part.kind === 'text' ? part.text : '')) : []
    }
    expect(textOf(model.requests[0]!)[0]).toContain('in Spending')
    expect(textOf(model.requests[1]!)).toEqual(['Second'])
    expect(textOf(model.requests[2]!)[0]).toContain('in Loans')
    expect(model.requests[2]!.turns).toHaveLength(5)
    expect(model.requests[0]!.system[0]!.text).toBe('Be Kuna.')
  })

  it('names the tab open when the catalogue declares it, and sends no other part of the query', async () => {
    const model = scripted([answer('One')])
    port.current = model
    await sendChatMessage('First', { ...CONTEXT, query: { tab: 'review', counterparty: 'Shop on the corner' } }, knowledge)
    const first = model.requests[0]!.turns.at(-1)!
    const text = first.role === 'user' ? first.parts.map((part) => (part.kind === 'text' ? part.text : '')).join('') : ''
    expect(text).toContain('on the screen Entries, tab To review (/spending/transactions?tab=review)')
    expect(text).not.toContain('Shop on the corner')
  })

  it("names a new app's other set-up lines only while the chat may read the books", async () => {
    const model = scripted([answer('Hi.'), answer('Hi again.')])
    port.current = model
    const where = { ...CONTEXT, setUp: [{ app: 'spending', name: 'Spending', hasFile: true, starting: ['first-entries'], others: ['categories'] }] }
    await sendChatMessage('Hi', where, knowledge)
    allowThisChat('anthropic')
    await sendChatMessage('Hi', where, knowledge)

    expect(JSON.stringify(model.requests[0]!.turns)).toContain('Set-up lines left: first-entries.')
    expect(JSON.stringify(model.requests[1]!.turns)).toContain('Set-up lines left: first-entries, categories.')
  })

  it('shows a cost that adds up and never stops on it', async () => {
    port.current = scripted([answer('One'), answer('Two')])
    await sendChatMessage('First', CONTEXT, knowledge)
    await sendChatMessage('Second', CONTEXT, knowledge)
    // Each request is 1,000 in at $2 and 1,000 out at $10 a million, so two are 2.4 cents.
    expect(chatSpent.value).toBe(words.usage.about('$0.02'))
  })

  it('says price unknown for a model Kuna has no price for', async () => {
    port.current = scripted([answer('One')], null)
    await sendChatMessage('First', CONTEXT, knowledge)
    expect(chatSpent.value).toBe(words.usage.priceUnknown)
  })

  it('leaves the turns as they were after a failure, and offers the same message again', async () => {
    const model = scripted([answer('One'), { kind: 'refused', reason: 'No.', tokens: TOKENS }, answer('Three')])
    port.current = model
    await sendChatMessage('First', CONTEXT, knowledge)
    await sendChatMessage('Second', CONTEXT, knowledge)
    expect(chatLines.at(-1)!.failure).toBe(words.result.refused('No.'))
    expect(chatLines.at(-1)!.retry).toBe('Second')
    await sendChatMessage('Second', CONTEXT, knowledge)
    expect(model.requests[2]!.turns).toHaveLength(3)
    expect(chatStatus.value).toBe('ready')
  })

  it("starts a new chain, and says so, when the model changes, as one model cannot read another's turns", async () => {
    const model = scripted([answer('One'), answer('Two')])
    port.current = model
    await sendChatMessage('First', CONTEXT, knowledge)
    pickModel('anthropic', 'claude-opus-5-5')
    await sendChatMessage('Second', CONTEXT, knowledge)
    expect(model.requests[1]!.turns).toHaveLength(1)
    expect(chatLines.some((line) => line.note && line.text === words.chat.chainChanged)).toBe(true)
  })

  it('reads a tool and links what it shows under the answer, dropping what the model wrote before the lookup', async () => {
    const model = scripted([
      async (request) => {
        request.onDelta?.('Let me look.')
        return { kind: 'tool-calls', calls: [{ id: 'one', name: 'kuna_docs', args: { path: 'spending' } }], raw: [], tokens: TOKENS }
      },
      { kind: 'tool-calls', calls: [{ id: 'two', name: 'show_screen', args: { route: '/spending', params: [] } }], raw: [], tokens: TOKENS },
      async (request) => {
        request.onDelta?.('Here it is.')
        return answer('Here it is.')
      },
    ])
    port.current = model
    await sendChatMessage('Where?', CONTEXT, knowledge)
    expect(chatLines.at(-1)!.text).toBe('Here it is.')
    expect(chatLines.at(-1)!.chips).toEqual([{ kind: 'screen', to: '/spending', label: 'Spending: Overview' }])
  })

  it('shows a link only once the answer is whole, so the text landing above it never moves it', async () => {
    const chipsWhileWritten: number[] = []
    port.current = scripted([
      { kind: 'tool-calls', calls: [{ id: 'one', name: 'show_screen', args: { route: '/spending', params: [] } }], raw: [], tokens: TOKENS },
      async (request) => {
        chipsWhileWritten.push(chatLines.at(-1)!.chips.length)
        request.onDelta?.('Here it is.')
        chipsWhileWritten.push(chatLines.at(-1)!.chips.length)
        return answer('Here it is.')
      },
    ])
    await sendChatMessage('Where?', CONTEXT, knowledge)
    expect(chipsWhileWritten).toEqual([0, 0])
    expect(chatLines.at(-1)!.chips).toHaveLength(1)
  })

  it('keeps the link of an answer the person stopped', async () => {
    const model = scripted([
      { kind: 'tool-calls', calls: [{ id: 'one', name: 'show_screen', args: { route: '/spending', params: [] } }], raw: [], tokens: TOKENS },
      (request) =>
        new Promise((_, refuse) => {
          request.signal?.addEventListener('abort', () => refuse(new Error('aborted')))
        }),
    ])
    port.current = model
    const sending = sendChatMessage('Where?', CONTEXT, knowledge)
    await vi.waitFor(() => expect(model.requests).toHaveLength(2))
    stopChatMessage()
    await sending
    expect(chatLines.at(-1)!.chips).toHaveLength(1)
    expect(chatLines.at(-1)!.stopped).toBe(true)
  })

  it('drops an empty answer once the person stops it, with nothing to retry', async () => {
    port.current = scripted([
      (request) =>
        new Promise((_, refuse) => {
          request.signal?.addEventListener('abort', () => refuse(new Error('aborted')))
        }),
    ])
    const sending = sendChatMessage('First', CONTEXT, knowledge)
    await vi.waitFor(() => expect(chatStatus.value).toBe('streaming'))
    await new Promise((resolve) => setTimeout(resolve))
    stopChatMessage()
    await sending
    expect(chatLines.map((line) => line.text)).toEqual(['First'])
    expect(chatStatus.value).toBe('ready')
  })

  it('keeps a yes for this chat until a new chat, on the provider it was given for, and stores nothing, while Always allow holds across chats', () => {
    const storedBefore = localStorage.length
    expect(chatAllowed('anthropic')).toBe(false)
    allowThisChat('anthropic')
    expect(chatAllowed('anthropic')).toBe(true)
    expect(chatAllowed('openai')).toBe(false)
    expect(localStorage.length).toBe(storedBefore)
    clearChat()
    expect(chatAllowed('anthropic')).toBe(false)
    allowAssist('anthropic', true)
    expect(chatAllowed('anthropic')).toBe(true)
  })

  describe('reading', () => {
    /** The text of the tool result that went in the given request. */
    const resultIn = (request: ModelRequest): string => {
      const last = request.turns.at(-1)!
      return last.role === 'tool-results' ? last.results[0]!.text : ''
    }

    it('reads once the chat is allowed, and shows the exact text that went, aliases and all', async () => {
      allowThisChat('anthropic')
      const model = scripted([lookup('find_records', READ_ROWS), answer('Person 1 got 600,00 €.')])
      port.current = model
      await sendChatMessage('Who got the rent?', CONTEXT, knowledge)
      const line = chatLines.at(-1)!
      expect(line.sent).toHaveLength(1)
      expect(line.sent[0]!.text).toBe(resultIn(model.requests[1]!))
      expect(line.sent[0]!.text).toContain('Person 1')
      expect(line.sent[0]!.text).not.toContain('Horvat')
      expect(line.sent[0]!.read).toMatchObject({ kind: 'records', app: 'Spending', count: 3 })
      expect(line.text).toBe('Person 1 got 600,00 €.')
      expect(shownOnScreen(line.text)).toContain('Ana Horvat')
      expect(line.strayFigure).toBe(false)
    })

    it('reads with a yes for this chat or with Always allow for the company, and the yes for this chat stores nothing', async () => {
      const storedBefore = localStorage.length
      allowThisChat('anthropic')
      port.current = scripted([lookup('find_records', READ_ROWS), answer('One')])
      await sendChatMessage('First', CONTEXT, knowledge)
      expect(chatLines.at(-1)!.sent).toHaveLength(1)
      expect(assistAllowed('anthropic')).toBe(false)
      expect(localStorage.length).toBe(storedBefore)
      clearChat()
      allowAssist('anthropic', true)
      port.current = scripted([lookup('find_records', READ_ROWS), answer('Two')])
      await sendChatMessage('Second', CONTEXT, knowledge)
      expect(chatLines.at(-1)!.sent).toHaveLength(1)
    })

    it('reads nothing from the books without a yes, and tells the model so as a plain fact', async () => {
      const model = scripted([lookup('find_records', READ_ROWS), lookup('read_figures', { app: 'spending', report: 'month', period: null }), answer('Could not read.')])
      port.current = model
      await sendChatMessage('First', CONTEXT, knowledge)
      expect(chatLines.at(-1)!.sent).toEqual([])
      expect(chatLines.at(-1)!.text).toBe('Could not read.')
      for (const request of model.requests) expect(JSON.stringify(request)).not.toContain('Corner market')
      expect(resultIn(model.requests[1]!)).toContain('not allowed')
      expect(resultIn(model.requests[1]!)).not.toContain('Carry on')
    })

    it('holds a yes to the company it named, so another company reads nothing', async () => {
      allowThisChat('anthropic')
      allowAssist('anthropic', true)
      pickProvider('openai')
      port.current = scripted([lookup('find_records', READ_ROWS), answer('One')])
      await sendChatMessage('First', CONTEXT, knowledge)
      expect(chatLines.at(-1)!.sent).toEqual([])
    })

    it('reads nothing more once Always allow is taken back while the chat has no yes of its own', async () => {
      allowAssist('anthropic', true)
      port.current = scripted([
        lookup('find_records', READ_ROWS, 'first'),
        async () => {
          allowAssist('anthropic', false)
          return lookup('find_records', READ_ROWS, 'second')
        },
        answer('Done.'),
      ])
      await sendChatMessage('First', CONTEXT, knowledge)
      expect(chatLines.at(-1)!.sent).toHaveLength(1)
    })

    it('shows the figure of a ref, and flags an amount no tool gave', async () => {
      allowThisChat('anthropic')
      port.current = scripted([lookup('read_figures', { app: 'spending', report: 'month', period: '2026-10' }), answer('You spent [f1], and €4,300.00 last year.')])
      await sendChatMessage('First', CONTEXT, knowledge)
      expect(chatLines.at(-1)!.strayFigure).toBe(true)
      expect(chatFigure('f1')).toMatchObject({ cents: 64530, currency: 'EUR' })
      expect(chatFigure('f9')).toBeNull()
    })

    it('sends real names with the setting off, while the loop still cuts an IBAN', async () => {
      switchAnonymise('anthropic', false)
      allowThisChat('anthropic')
      const model = scripted([lookup('find_records', READ_ROWS), answer('One')])
      port.current = model
      await sendChatMessage('First', CONTEXT, knowledge)
      const sent = chatLines.at(-1)!.sent[0]!.text
      expect(sent).toContain('Ana Horvat')
      expect(sent).not.toContain(IBAN_OF_ANA)
      expect(sent).toBe(resultIn(model.requests[1]!))
      switchAnonymise('anthropic', true)
    })

    it('forgets the aliases and the refs on a new chat', async () => {
      allowThisChat('anthropic')
      port.current = scripted([lookup('find_records', READ_ROWS), answer('Person 1')])
      await sendChatMessage('First', CONTEXT, knowledge)
      expect(shownOnScreen('Person 1')).not.toBe('Person 1')
      clearChat()
      expect(shownOnScreen('Person 1')).toBe('Person 1')
    })

    it('says the row went only once the request left: a guarded request sent nothing', async () => {
      allowThisChat('anthropic')
      const { guardedModel } = await import('../src/shared/ai/application/egressGuard')
      const inner = scripted([lookup('find_records', READ_ROWS), answer('Never')])
      port.current = guardedModel(inner, () => ['Corner market'])
      await sendChatMessage('First', CONTEXT, knowledge)
      expect(chatLines.at(-1)!.sent).toEqual([])
      expect(chatLines.at(-1)!.failure).toBe(words.result.holdsSecret)
      expect(inner.requests).toHaveLength(1)
    })
  })

  it('forgets everything on a new chat', async () => {
    const model = scripted([answer('One'), answer('Two')])
    port.current = model
    await sendChatMessage('First', CONTEXT, knowledge)
    clearChat()
    expect(chatLines).toEqual([])
    expect(chatSpent.value).toBeNull()
    await sendChatMessage('Again', CONTEXT, knowledge)
    expect(model.requests[1]!.turns).toHaveLength(1)
  })
})

describe('a card in the chat', () => {
  const TIDY: AppProposer = {
    operations: [{ name: 'tidy', about: 'Tidies.', input: { type: 'object', properties: {}, required: [], additionalProperties: false }, refs: {}, creates: null, alone: false, example: {} }],
    readsBooks: true,
    check: async (title) => ({ title, count: 1, groups: [], outside: [], undoable: true, heldBack: null, held: {} }),
  }
  const WITH_TIDY: Catalogue = { ...CATALOGUE, proposers: new Map([['spending', TIDY]]) }

  it('stays done with no Undo when Kuna refuses the Undo, says why, and tells the model the write stands', async () => {
    allowThisChat('anthropic')
    const model = scripted([lookup('propose_changes', { app: 'spending', title: 'Tidy up', steps: [{ op: 'tidy', input: '{}', as: null }], next: false }), answer('Card shown.'), answer('Noted.')])
    port.current = model
    await sendChatMessage('Tidy', CONTEXT, async () => WITH_TIDY)
    const card = chatLines.at(-1)!.proposals[0]!
    settleProposal(card as ChatProposal, 'done', null, async () => ({ kind: 'refused', reason: 'A later write stands on it.' }))

    await undoProposal(card)

    expect(card).toMatchObject({ state: 'done', undo: null, reason: 'A later write stands on it.' })
    await sendChatMessage('And now?', CONTEXT, async () => WITH_TIDY)
    expect(JSON.stringify(model.requests[2]!.turns)).toContain('tried to undo the card \\"Tidy up\\"')
  })

  it('names the files the model read in the turn that made a card, and none on a card of a later turn or without a read', async () => {
    allowThisChat('anthropic')
    const tidy = (id: string) => lookup('propose_changes', { app: 'spending', title: 'Tidy up', steps: [{ op: 'tidy', input: '{}', as: null }], next: false }, id)
    await attachFiles([picked('october.csv', new TextEncoder().encode('date,amount\n2026-10-01,-12.00'), 'text/csv'), picked('notes.csv', new TextEncoder().encode('note\nhello'), 'text/csv')])
    const [october] = chatPromptFiles.value as readonly Extract<PromptFile, { readonly state: 'ready' }>[]
    port.current = scripted([
      tidy('before'),
      lookup('read_attachment', { attachment: october!.attachment.id, pages: null, sheet: null, rows: '1-2' }, 'read'),
      tidy('after'),
      answer('Card shown.'),
      tidy('later'),
      answer('Another card.'),
    ])

    await sendChatMessage('Tidy after reading the file', CONTEXT, async () => WITH_TIDY)
    await sendChatMessage('Once more', CONTEXT, async () => WITH_TIDY)

    const cards = chatLines.flatMap((line) => line.proposals)
    expect(cards.map((card) => card.readFiles)).toEqual([[], ['october.csv'], []])
    clearChat()
    allowThisChat('anthropic')
    port.current = scripted([tidy('fresh'), answer('Card shown.')])
    await sendChatMessage('Tidy', CONTEXT, async () => WITH_TIDY)
    expect(chatLines.at(-1)!.proposals[0]!.readFiles).toEqual([])
  })
})

describe('the chat going on with a job of several cards', () => {
  const TIDY: AppProposer = {
    operations: [{ name: 'tidy', about: 'Tidies.', input: { type: 'object', properties: {}, required: [], additionalProperties: false }, refs: {}, creates: null, alone: false, example: {} }],
    readsBooks: false,
    check: async (title) => ({ title, count: 1, groups: [], outside: [], undoable: true, heldBack: null, held: {} }),
  }
  const WITH_TIDY: Catalogue = { ...CATALOGUE, proposers: new Map([['spending', TIDY]]) }
  const SETTING_UP = { ...CONTEXT, setUp: [{ app: 'spending', name: 'Spending', hasFile: true, starting: ['first-account'], others: [] }] }
  const tidy = (id = 'tidy', next = true): ModelReply => lookup('propose_changes', { app: 'spending', title: 'Tidy up', steps: [{ op: 'tidy', input: '{}', as: null }], next }, id)
  /** Every message the panel would send by itself, sent as the panel sends it. */
  const wentOn: string[] = []

  beforeEach(() => {
    wentOn.splice(0)
    allowThisChat('anthropic')
    sendChatFrom((message, origin) => {
      wentOn.push(message)
      void sendChatMessage(message, SETTING_UP, async () => WITH_TIDY, origin)
    })
  })

  async function cardShown(next = true, where = SETTING_UP): Promise<ChatProposal> {
    port.current = scripted([tidy('tidy', next), answer('Card shown.'), tidy('next'), answer('Next card.')])
    await sendChatMessage('Set up Spending', where, async () => WITH_TIDY)
    return chatLines.at(-1)!.proposals[0]! as ChatProposal
  }

  it('shows a card only once the answer is whole, so the text landing above it never moves Accept', async () => {
    const cardsWhileWritten: number[] = []
    port.current = scripted([
      tidy(),
      async (request) => {
        cardsWhileWritten.push(chatLines.at(-1)!.proposals.length)
        request.onDelta?.('Card shown.')
        cardsWhileWritten.push(chatLines.at(-1)!.proposals.length)
        return answer('Card shown.')
      },
    ])
    await sendChatMessage('Set up Spending', SETTING_UP, async () => WITH_TIDY)
    expect(cardsWhileWritten).toEqual([0, 0])
    expect(chatLines.at(-1)!.proposals).toHaveLength(1)
  })

  it('sends Go on once a card the model says another follows is accepted, and says so on the card', async () => {
    const card = await cardShown()
    expect(card.goesOn).toBe(true)

    settleProposal(card, 'done')

    expect(wentOn).toEqual([words.chat.goOn])
  })

  it('goes on with a job laid out in steps outside a setup, such as sorting the rows waiting, and waits after Not now', async () => {
    const card = await cardShown(true, CONTEXT)
    expect(card.goesOn).toBe(true)
    settleProposal(card, 'done')
    expect(wentOn).toEqual([words.chat.goOn])
    await vi.waitFor(() => expect(chatStatus.value).toBe('ready'))
    const next = chatLines.at(-1)!.proposals[0]! as ChatProposal
    expect(next.goesOn).toBe(true)

    settleProposal(next, 'declined')

    expect(wentOn).toEqual([words.chat.goOn])
  })

  it('does not go on for the last card of a job, or after Not now, even while the app is new', async () => {
    const card = await cardShown(false)
    expect(card.goesOn).toBe(false)
    settleProposal(card, 'done')
    const declined = await cardShown()
    settleProposal(declined, 'declined')

    expect(wentOn).toEqual([])
  })

  /** A reply the test hands over once it has done what happens while the message is under way, with the request's arrival to wait on. */
  function heldReply(): { readonly reply: (request: ModelRequest) => Promise<ModelReply>; readonly asked: Promise<void>; finish(reply: ModelReply): void } {
    let arrived: () => void = () => undefined
    const asked = new Promise<void>((resolve) => (arrived = resolve))
    let finish: (reply: ModelReply) => void = () => undefined
    const given = new Promise<ModelReply>((resolve) => (finish = resolve))
    return {
      asked,
      finish: (reply) => finish(reply),
      reply: (request) => {
        arrived()
        return new Promise<ModelReply>((resolve, reject) => {
          request.signal?.addEventListener('abort', () => reject(new Error('aborted')))
          void given.then(resolve)
        })
      },
    }
  }

  it('waits for a message under way, then goes on once it ends', async () => {
    const card = await cardShown()
    const held = heldReply()
    port.current = scripted([held.reply, tidy('next'), answer('Next card.')])
    const running = sendChatMessage('Is the account right?', SETTING_UP, async () => WITH_TIDY)
    await held.asked

    settleProposal(card, 'done')
    expect(wentOn).toEqual([])
    held.finish(answer('It is.'))
    await running

    expect(wentOn).toEqual([words.chat.goOn])
  })

  it('does not go on when the person stops the message under way', async () => {
    const card = await cardShown()
    const held = heldReply()
    port.current = scripted([held.reply])
    const running = sendChatMessage('Wait', SETTING_UP, async () => WITH_TIDY)
    await held.asked

    settleProposal(card, 'done')
    stopChatMessage()
    await running

    expect(wentOn).toEqual([])
  })

  it('does not go on after a message that failed', async () => {
    const card = await cardShown()
    const held = heldReply()
    port.current = scripted([held.reply])
    const running = sendChatMessage('Check it', SETTING_UP, async () => WITH_TIDY)
    await held.asked

    settleProposal(card, 'done')
    held.finish({ kind: 'refused', reason: 'Overloaded.', tokens: TOKENS })
    await running

    expect(wentOn).toEqual([])
  })

  it('goes on at most ten times in a row, and counts again once the person writes', async () => {
    sendChatFrom((message) => wentOn.push(message))
    port.current = scripted(Array.from({ length: 24 }, (_, at) => (at % 2 === 0 ? tidy(`card-${at}`) : answer('Card shown.'))))
    await sendChatMessage('Set up Spending', SETTING_UP, async () => WITH_TIDY)
    for (let sent = 0; sent < 10; sent += 1) await sendChatMessage(words.chat.goOn, SETTING_UP, async () => WITH_TIDY, 'goOn')
    expect(chatLines.at(-1)!.proposals[0]!.goesOn).toBe(false)

    await sendChatMessage('Next please', SETTING_UP, async () => WITH_TIDY)

    expect(chatLines.at(-1)!.proposals[0]!.goesOn).toBe(true)
  })

  it('leaves the files on the prompt when it goes on by itself, as the person never sent them', async () => {
    const card = await cardShown()
    await attachFiles([picked('october.csv', new TextEncoder().encode('date,amount\n2026-10-01,-12.00'), 'text/csv')])
    await vi.waitFor(() => expect(chatPromptFiles.value[0]?.state).toBe('ready'))

    settleProposal(card, 'done')
    await vi.waitFor(() => expect(chatStatus.value).toBe('ready'))

    expect(chatLines.at(-2)!).toMatchObject({ role: 'user', text: words.chat.goOn, attachments: [], byKuna: true })
    expect(chatPromptFiles.value.map((file) => file.name)).toEqual(['october.csv'])
  })
})

describe('files on the prompt', () => {
  it('reads each file on the device, refuses one Kuna takes no kind of with why, and lets a person remove one', async () => {
    await attachFiles([statementPdf(), picked('notes.docx', new Uint8Array([1])), picked('receipt.jpg', new Uint8Array([1]), 'image/jpeg')])

    const [pdf, notes, photo] = chatPromptFiles.value
    expect(chatPromptFiles.value.map((file) => file.state)).toEqual(['ready', 'refused', 'ready'])
    expect(notes).toMatchObject({ name: 'notes.docx', refusal: { reason: 'unknown-kind' } })
    expect(pdf).toMatchObject({ attachment: { kind: 'pdf', pages: 1, sent: null } })
    expect(photo).toMatchObject({ attachment: { kind: 'photo', sent: { width: 1092, height: 1092 } } })
    removePromptFile(pdf!.key)
    expect(chatPromptFiles.value.map((file) => file.name)).toEqual(['notes.docx', 'receipt.jpg'])
  })

  it('warns once for the files of cells and once for every photo and PDF, naming the AI company and how many go whole', async () => {
    await attachFiles([
      picked('october.csv', new TextEncoder().encode('date,amount\n2026-10-01,-12.00'), 'text/csv'),
      picked('november.csv', new TextEncoder().encode('date,amount\n2026-11-01,-3.00'), 'text/csv'),
      statementPdf(),
      picked('receipt.jpg', new Uint8Array([1]), 'image/jpeg'),
    ])
    const company = providerInUse()!.name
    const whole = `2 photos and PDFs go to ${company} whole, with every name and amount in them. Anonymise does not reach into them.`
    expect(promptFileNotes.value).toEqual([words.files.goesAsCells(company), whole])
    switchAnonymise('anthropic', false)
    try {
      expect(promptFileNotes.value).toEqual([words.files.goesAsCellsPlain(company), whole])
    } finally {
      switchAnonymise('anthropic', true)
    }
  })

  it('says what photos, PDFs and a file sent as cells add to the cost', async () => {
    await attachFiles([picked('october.csv', new TextEncoder().encode('date,amount\n2026-10-01,-12.00'), 'text/csv')])
    expect(promptFilesCost.value).toMatch(/^Reading them costs .+, then .+ with each later message\.$/)
    await attachFiles([picked('receipt.jpg', new Uint8Array([1]), 'image/jpeg')])
    expect(promptFilesCost.value).toMatch(/^Reading them costs .+, then .+ with each later message\.$/)
  })

  it('sends the files with the message by id and kind, keeps only their names on its line, and empties the prompt', async () => {
    allowThisChat('anthropic')
    const model = scripted([answer('Read.')])
    port.current = model
    await attachFiles([statementPdf(), picked('notes.docx', new Uint8Array([1]))])
    const id = (chatPromptFiles.value[0] as Extract<PromptFile, { readonly state: 'ready' }>).attachment.id

    await sendChatMessage('Import this', CONTEXT, knowledge)

    expect(chatLines.find((line) => line.role === 'user')?.attachments).toEqual(['Statement October.pdf'])
    expect(chatPromptFiles.value).toEqual([])
    const sent = JSON.stringify(model.requests[0]!.turns)
    expect(sent).toContain(`Files attached to this chat: ${id} (pdf, 1 page, 1 read).`)
    expect(sent).not.toContain('Statement October')
  })

  it('keeps a PDF waiting while the provider reads none, and lets it go once the provider does', async () => {
    pickProvider('openrouter')
    await attachFiles([statementPdf()])
    expect(chatPromptFiles.value[0]).toMatchObject({ state: 'refused', refusal: { reason: 'no-pdf', provider: 'OpenRouter' } })
    expect(promptFilesCost.value).toBeNull()
    pickProvider('anthropic')
    expect(chatPromptFiles.value[0]).toMatchObject({ state: 'ready' })
    expect(promptFilesCost.value).not.toBeNull()
  })

  it('refuses a PDF before any request when the provider reads none, and keeps the message unsent', async () => {
    pickProvider('openrouter')
    const model = scripted([answer('Read.')])
    port.current = model
    await attachFiles([statementPdf()])

    await sendChatMessage('Import this', CONTEXT, knowledge)

    expect(model.requests).toEqual([])
    expect(chatLines).toEqual([])
    expect(chatPromptFiles.value[0]).toMatchObject({ state: 'refused', refusal: { reason: 'no-pdf', provider: 'OpenRouter' } })
  })

  it("drops every file on a new chat, and a read still under way from the last one cannot take a new file's place", async () => {
    const reading = attachFiles([statementPdf()])
    clearChat()
    await attachFiles([picked('receipt.jpg', new Uint8Array([1]), 'image/jpeg')])
    await reading
    expect(chatPromptFiles.value.map((file) => file.name)).toEqual(['receipt.jpg'])
  })
})

describe('the tagged element', () => {
  const RECORD: ChatElementAbout = { kind: 'record', app: 'spending', recordKind: 'transaction', id: CHAT_BOOK.transactions[0]!.id }
  const BUILD_UP: ChatElementAbout = {
    kind: 'build-up',
    app: 'spending',
    trace: { label: 'Spent', on: null, amount: moneyFromCents(100), basis: 'Sum', rules: [], steps: [], stepsLeftOut: 0 },
    subtitle: 'October 2026',
    employees: false,
  }
  const userText = (request: ModelRequest): string => {
    const last = request.turns.at(-1)!
    return last.role === 'user' ? last.parts.map((part) => (part.kind === 'text' ? part.text : '')).join('\n') : ''
  }

  it('names the element once while it stays tagged, by the same ref, and says when the tag goes', async () => {
    allowThisChat('anthropic')
    const model = scripted([answer('One'), answer('Two'), answer('Three')])
    port.current = model
    await sendChatMessage('What is this?', { ...CONTEXT, element: RECORD }, knowledge)
    await sendChatMessage('And now?', { ...CONTEXT, element: RECORD }, knowledge)
    await sendChatMessage('Anything else?', CONTEXT, knowledge)

    expect(userText(model.requests[0]!)).toContain('Tagged element: the transaction transaction-1 of spending')
    expect(userText(model.requests[1]!)).not.toContain('Tagged element')
    expect(userText(model.requests[2]!)).toContain(NOTHING_TAGGED)
  })

  it('gives a build-up the same ref each time the same object is tagged', async () => {
    allowThisChat('anthropic')
    const model = scripted([answer('One'), answer('Two'), answer('Three')])
    port.current = model
    await sendChatMessage('Explain', { ...CONTEXT, element: BUILD_UP }, knowledge)
    await sendChatMessage('And this row?', { ...CONTEXT, element: RECORD }, knowledge)
    await sendChatMessage('Back to the figure', { ...CONTEXT, element: BUILD_UP }, knowledge)

    expect(userText(model.requests[0]!)).toContain('the build-up build-up-1 of a figure of spending')
    expect(userText(model.requests[2]!)).toContain('the build-up build-up-1 of a figure of spending')
  })
})

describe('what a card says it leaves outside the books', () => {
  const proposerWith = (outside: readonly string[], undoable: boolean): AppProposer => ({
    operations: [{ name: 'fetch', about: 'Fetches.', input: { type: 'object', properties: {}, required: [], additionalProperties: false }, refs: {}, creates: null, alone: false, example: {} }],
    readsBooks: false,
    check: async (title) => ({ title, count: 1, groups: [], outside, undoable, heldBack: null, held: {} }),
  })

  async function shownCard(proposer: AppProposer): Promise<ChatProposal> {
    allowThisChat('anthropic')
    port.current = scripted([lookup('propose_changes', { app: 'spending', title: 'Fetch prices', steps: [{ op: 'fetch', input: '{}', as: null }], next: false }), answer('Card shown.')])
    await sendChatMessage('Fetch', CONTEXT, async () => ({ ...CATALOGUE, proposers: new Map([['spending', proposer]]) }))
    return chatLines.at(-1)!.proposals[0]! as ChatProposal
  }

  it('carries the lines of what stays outside on the card', async () => {
    const card = await shownCard(proposerWith(['The PDF stays on Drive after Undo.'], true))
    expect(card.checked?.outside).toEqual(['The PDF stays on Drive after Undo.'])
  })

  it('carries a card that has no Undo, so it says so before Accept', async () => {
    const card = await shownCard(proposerWith([], false))
    expect(card.checked?.undoable).toBe(false)
  })
})

describe('starting a chat with files, a tag and a task', () => {
  const READ_IT = 'Read the attached receipt and add it to its payment.'
  const PHOTO = (): File => picked('receipt.jpg', new Uint8Array([1]), 'image/jpeg')
  const ROW = { key: 'row-1', label: 'Corner market, 3 Nov', about: { kind: 'record', app: 'spending', recordKind: 'transaction', id: CHAT_BOOK.transactions[0]!.id } } as const
  const FETCH: AppProposer = {
    operations: [{ name: 'fetch', about: 'Fetches.', input: { type: 'object', properties: {}, required: [], additionalProperties: false }, refs: {}, creates: null, alone: false, example: {} }],
    readsBooks: false,
    check: async (title) => ({ title, count: 1, groups: [], outside: [], undoable: true, heldBack: null, held: {} }),
  }

  beforeEach(() => {
    closeChat()
    removeChatElement()
    takeChatRequest()
    allowThisChat('anthropic')
  })

  it('counts a chat as going on once a message goes in this visit, and not after New chat', async () => {
    port.current = scripted([answer('One')])
    expect(chatGoingOn.value).toBe(false)
    await sendChatMessage('First', CONTEXT, knowledge)
    expect(chatGoingOn.value).toBe(true)
    await startChatWith({}, 'new-chat')
    expect(chatGoingOn.value).toBe(false)
    expect(chatLines).toEqual([])
  })

  it('starts a new chat for a photo from a page while none is going on, dropping a tag and a file put there alone', async () => {
    openChatAbout(ROW)
    await attachFiles([picked('october.csv', new TextEncoder().encode('date,amount\n2026-10-01,-12.00'), 'text/csv')])

    await startChatWith({ files: [PHOTO()], task: READ_IT }, 'page')

    expect(chatOpen.value).toBe(true)
    expect(chatElement.value).toBeNull()
    expect(chatPromptFiles.value.map((file) => file.name)).toEqual(['receipt.jpg'])
    expect(chatRequest.value).toBe(READ_IT)
  })

  it('joins a chat going on with a photo from a page, keeping what was said and the tag', async () => {
    port.current = scripted([answer('One')])
    await sendChatMessage('First', CONTEXT, knowledge)
    openChatAbout(ROW)
    closeChat()

    await startChatWith({ files: [PHOTO()], task: READ_IT }, 'page')

    expect(chatLines.map((line) => line.text)).toEqual(['First', 'One'])
    expect(chatElement.value).toEqual(ROW)
    expect(chatPromptFiles.value.map((file) => file.name)).toEqual(['receipt.jpg'])
    expect(chatRequest.value).toBe(READ_IT)
  })

  it('joins the closed chat that holds an open card, which stays open', async () => {
    port.current = scripted([lookup('propose_changes', { app: 'spending', title: 'Fetch prices', steps: [{ op: 'fetch', input: '{}', as: null }], next: false }), answer('Card shown.')])
    await sendChatMessage('Fetch', CONTEXT, async () => ({ ...CATALOGUE, proposers: new Map([['spending', FETCH]]) }))
    closeChat()

    await startChatWith({ files: [PHOTO()], task: READ_IT }, 'page')

    expect(chatLines.at(-1)!.proposals.map((card) => card.state)).toEqual(['open'])
    expect(chatPromptFiles.value.map((file) => file.name)).toEqual(['receipt.jpg'])
  })

  it('starts over on New chat even while a chat is going on', async () => {
    port.current = scripted([answer('One')])
    await sendChatMessage('First', CONTEXT, knowledge)
    openChatAbout(ROW)

    await startChatWith({}, 'new-chat')

    expect(chatLines).toEqual([])
    expect(chatElement.value).toBeNull()
  })

  it('leaves the task only once the photo is read, as a file still read does not go with a message', async () => {
    const starting = startChatWith({ files: [PHOTO()], task: READ_IT }, 'page')
    expect(chatPromptFiles.value.map((file) => file.state)).toEqual(['reading'])
    expect(chatRequest.value).toBeNull()

    await starting

    expect(chatPromptFiles.value.map((file) => file.state)).toEqual(['ready'])
    expect(chatRequest.value).toBe(READ_IT)
  })

  it('leaves no task when every file was refused, so the chat is not asked to read what is not there', async () => {
    await startChatWith({ files: [picked('notes.docx', new Uint8Array([1]))], task: READ_IT }, 'page')

    expect(chatPromptFiles.value.map((file) => file.state)).toEqual(['refused'])
    expect(chatRequest.value).toBeNull()
  })

  /** A reply that waits until `release` is called, so a test can act while the answer streams. */
  function heldAnswer(text: string): { readonly reply: () => Promise<ModelReply>; readonly release: () => void } {
    let release = (): void => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    return { reply: async () => (await gate, answer(text)), release }
  }

  it('holds a task that arrives while an answer streams and sends it by itself once the answer ends', async () => {
    const held = heldAnswer('One')
    port.current = scripted([held.reply, answer('Read.')])
    const sent: [string, string][] = []
    sendChatFrom((message, origin) => {
      sent.push([message, origin])
      void sendChatMessage(message, CONTEXT, knowledge, origin)
    })
    try {
      const first = sendChatMessage('First', CONTEXT, knowledge)
      await vi.waitFor(() => expect(chatStatus.value).toBe('streaming'))

      sendTask(READ_IT)
      expect(sent).toEqual([])

      held.release()
      await first
      expect(sent).toEqual([[READ_IT, 'task']])
      await vi.waitFor(() => expect(chatStatus.value).toBe('ready'))
      expect(chatLines.at(-2)).toMatchObject({ role: 'user', text: READ_IT, byKuna: true })
    } finally {
      sendChatFrom(null)
    }
  })

  it('holds a task while no panel is open and sends it once one opens, and drops it on a new chat', async () => {
    const sent: string[] = []
    sendTask(READ_IT)
    sendChatFrom((message) => sent.push(message))
    expect(sent).toEqual([READ_IT])
    sendChatFrom(null)

    sendTask(READ_IT)
    clearChat()
    sendChatFrom((message) => sent.push(message))
    sendChatFrom(null)
    expect(sent).toEqual([READ_IT])
  })

  it('tags the element a page gives with the photo, so a row can start a chat about itself', async () => {
    await startChatWith({ files: [PHOTO()], element: ROW, task: READ_IT }, 'page')

    expect(chatElement.value).toEqual(ROW)
    expect(chatOpen.value).toBe(true)
    expect(chatRequest.value).toBe(READ_IT)
  })
})
