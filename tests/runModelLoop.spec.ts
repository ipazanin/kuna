import { describe, expect, it } from 'vitest'

import { ModelRequestFailed } from '../src/shared/ai/application/modelPort'
import type { ModelPort, ModelReply, ModelRequest, ModelTool, ToolCall, ToolResult } from '../src/shared/ai/application/modelPort'
import { runModelLoop } from '../src/shared/ai/application/runModelLoop'
import type { LoopEnd, ModelLoop } from '../src/shared/ai/application/runModelLoop'
import type { AiPart } from '../src/shared/ai/domain/aiPart'

const TOKENS = { input: 1000, cacheRead: 0, cacheWrite: 0, output: 200 }
const SONNET = { name: 'Sonnet 5.5', price: { inputPerMillion: 2, cacheReadPerMillion: 0.1, cacheWritePerMillion: 2.5, outputPerMillion: 10 } }
const ROUNDS = 6

const LOOKUP: ModelTool = {
  name: 'lookup',
  description: 'Looks one thing up.',
  input: { type: 'object', additionalProperties: false, required: ['id'], properties: { id: { type: 'string' } } },
}

async function lookup(call: ToolCall): Promise<ToolResult> {
  const { id } = call.args as { id: string }
  return id === 'missing' ? { text: 'Nothing is called missing.', parts: [], isError: true } : { text: `Rule ${id}, paid to HR1210010051863000160.`, parts: [], isError: false }
}

/** A model that answers each request with the next reply, noting what it was sent. */
function modelOf(replies: readonly ModelReply[]): ModelPort & { readonly sent: ModelRequest[] } {
  const sent: ModelRequest[] = []
  return {
    sent,
    readsPdf: true,
    model: SONNET,
    async send(request) {
      sent.push(structuredClone({ ...request, signal: undefined }))
      const reply = replies[sent.length - 1]
      if (reply === undefined) throw new Error('the model was asked once too often')
      return reply
    },
  }
}

function loopOver(model: ModelPort, parts: readonly AiPart[], change: Partial<ModelLoop> = {}): Promise<LoopEnd> {
  return runModelLoop({
    model,
    system: [{ kind: 'text', text: 'Label the row. The owner OIB is 12345678903.' }],
    turns: [{ role: 'user', parts }],
    tools: [LOOKUP],
    runTool: lookup,
    effort: 'low',
    rounds: ROUNDS,
    ...change,
  })
}

const answer = (text: string): ModelReply => ({ kind: 'answer', text, raw: null, tokens: TOKENS })
const ROW: AiPart = { kind: 'text', text: 'GITHUB INC, card, from HR12 1001 0051 8630 0016 0, OIB 98765432106' }

describe('a run of the model loop', () => {
  it('masks every text part and the system prompt, and leaves a PDF part as it is', async () => {
    const pdf: AiPart = { kind: 'pdf', base64: 'JVBERi0xLjQK', name: 'offer.pdf' }
    const model = modelOf([answer('software')])

    expect(await loopOver(model, [pdf, ROW])).toMatchObject({ kind: 'answer', text: 'software' })
    const [request] = model.sent
    expect(request!.turns).toEqual([{ role: 'user', parts: [pdf, { kind: 'text', text: 'GITHUB INC, card, from HR•• ••••0160, OIB [OIB]' }] }])
    expect(request!.system).toEqual([{ kind: 'text', text: 'Label the row. The owner OIB is [OIB].' }])
    expect(request!.effort).toBe('low')
  })

  it('gives the usage of every request with its cost at the list price', async () => {
    expect(await loopOver(modelOf([answer('software')]), [ROW])).toMatchObject({ usage: { model: 'Sonnet 5.5', inputTokens: 1000, outputTokens: 200, dollars: 0.004 } })
  })

  it('turns a refusal and a cut-off into their own ends', async () => {
    expect(await loopOver(modelOf([{ kind: 'refused', reason: 'Not this one.', tokens: TOKENS }]), [ROW])).toMatchObject({ kind: 'refused', reason: 'Not this one.' })
    expect(await loopOver(modelOf([{ kind: 'cut-off', tokens: TOKENS }]), [ROW])).toMatchObject({ kind: 'cut-off' })
  })

  it('turns a provider error into a failure with its message', async () => {
    const model: ModelPort = { ...modelOf([]), send: () => Promise.reject(new ModelRequestFailed(529, 'Overloaded')) }
    expect(await loopOver(model, [ROW])).toEqual({ kind: 'failed', reason: 'Overloaded', usage: null })
  })

  it('hands back the turns a chat keeps, ending with the whole assistant turn, and passes the pieces of the text along', async () => {
    const seen: unknown[] = []
    const model: ModelPort = {
      readsPdf: true,
      model: SONNET,
      async send(request) {
        seen.push(request.onDelta)
        return { kind: 'answer', text: 'Plain words.', raw: [{ type: 'text', text: 'Plain words.' }], tokens: TOKENS }
      },
    }
    const onDelta = (): void => undefined
    const end = await loopOver(model, [{ kind: 'text', text: 'Account HR1210010051863000160?' }], {
      system: [],
      tools: [],
      onDelta,
      rounds: 1,
    })
    expect(seen).toEqual([onDelta])
    expect(end).toMatchObject({ kind: 'answer', text: 'Plain words.' })
    expect(end.kind === 'answer' && end.turns).toEqual([
      { role: 'user', parts: [{ kind: 'text', text: 'Account HR•• ••••0160?' }] },
      { role: 'assistant', calls: [], raw: [{ type: 'text', text: 'Plain words.' }] },
    ])
  })

  it('passes its signal to the model on each request', async () => {
    const seen: (AbortSignal | undefined)[] = []
    const model: ModelPort = {
      readsPdf: true,
      model: SONNET,
      async send(request) {
        seen.push(request.signal)
        return answer('software')
      },
    }
    const { signal } = new AbortController()
    await loopOver(model, [ROW], { signal })
    expect(seen).toEqual([signal])
  })

  it('counts the tokens a failure spent, with those of the requests before it', async () => {
    const model: ModelPort = {
      readsPdf: true,
      model: SONNET,
      async send() {
        throw new ModelRequestFailed(200, 'It stopped for a reason Kuna does not know.', { input: 500, cacheRead: 0, cacheWrite: 0, output: 100 })
      },
    }
    expect(await loopOver(model, [ROW])).toMatchObject({ kind: 'failed', usage: { inputTokens: 500, outputTokens: 100 } })
  })

  it('prices each kind of token at its own rate, and gives no price for a model with none', async () => {
    const tokens = { input: 1000, cacheRead: 10_000, cacheWrite: 2000, output: 500 }
    const answered: ModelReply = { kind: 'answer', text: 'software', raw: null, tokens }
    // 1,000 at $2, 10,000 at $0.10, 2,000 at $2.50 and 500 at $10 per million.
    expect(await loopOver(modelOf([answered]), [ROW])).toMatchObject({ usage: { dollars: (2000 + 1000 + 5000 + 5000) / 1_000_000 } })
    const unpriced = { ...modelOf([answered]), model: { name: 'made-up-model', price: null } }
    expect(await loopOver(unpriced, [ROW])).toMatchObject({ usage: { model: 'made-up-model', inputTokens: 1000, dollars: null } })
  })
})

describe('the tool rounds of a loop', () => {
  const calls = (...ids: string[]): ModelReply => ({
    kind: 'tool-calls',
    calls: ids.map((id, index) => ({ id: `call-${index}`, name: 'lookup', args: { id } })),
    raw: { made: 'by the adapter' },
    tokens: TOKENS,
  })

  it("sends the results of one turn back in one message, masked, after the model's own turn", async () => {
    const model = modelOf([calls('hr.vat.rates', 'missing'), answer('software')])

    expect(await loopOver(model, [ROW])).toMatchObject({ kind: 'answer', usage: { inputTokens: 2000, outputTokens: 400 } })
    expect(model.sent[0]!.tools).toEqual([LOOKUP])
    expect(model.sent[1]!.turns.slice(1)).toEqual([
      { role: 'assistant', calls: [expect.objectContaining({ id: 'call-0' }), expect.objectContaining({ id: 'call-1' })], raw: { made: 'by the adapter' } },
      {
        role: 'tool-results',
        results: [
          { callId: 'call-0', text: 'Rule hr.vat.rates, paid to HR•• ••••0160.', parts: [], isError: false },
          { callId: 'call-1', text: 'Nothing is called missing.', parts: [], isError: true },
        ],
      },
    ])
  })

  it(`stops after ${ROUNDS} rounds of lookups`, async () => {
    const model = modelOf(Array.from({ length: ROUNDS + 1 }, () => calls('hr.vat.rates')))
    expect(await loopOver(model, [ROW])).toMatchObject({ kind: 'failed', reason: `more than ${ROUNDS} rounds of lookups` })
    expect(model.sent).toHaveLength(ROUNDS + 1)
  })
})
