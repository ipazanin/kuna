import { describe, expect, it } from 'vitest'

import { runModelLoop } from '../src/shared/ai/application/runModelLoop'
import type { ModelPort, ModelReply } from '../src/shared/ai/application/modelPort'
import { costOfDocument, costOfRequest, documentTokens } from '../src/shared/ai/domain/modelUsage'
import { PROVIDER_PRESETS } from '../src/shared/ai/domain/providerPresets'

const HAIKU = PROVIDER_PRESETS.flatMap((preset) => preset.models).find((model) => model.id === 'claude-haiku-5-5')!.price!
const SOL = PROVIDER_PRESETS.flatMap((preset) => preset.models).find((model) => model.id === 'gpt-6.1-sol')!.price!

describe('what a request costs', () => {
  it('is at the plain rates up to the step, counting cached tokens in the prompt', () => {
    // 100,000 fresh tokens at $0.10 a million, and 1,000 out at $0.50.
    expect(costOfRequest({ input: 100_000, cacheRead: 0, cacheWrite: 0, output: 1000 }, HAIKU)).toBeCloseTo(0.0105)
  })

  it('takes Haiku to five times over 100,000 tokens, cached ones counted', () => {
    // 100,000 from cache at $0.05 a million is $0.005, and 1,000 out at $2.50 a million is $0.0025.
    expect(costOfRequest({ input: 1, cacheRead: 100_000, cacheWrite: 0, output: 1000 }, HAIKU)).toBeCloseTo(0.0075)
  })

  it('takes GPT-6 to twice for input and one and a half times for output over 272,000', () => {
    // 272,001 fresh at $4 a million is $1.088, and 1,000 out at $15 is $0.015.
    expect(costOfRequest({ input: 272_001, cacheRead: 0, cacheWrite: 0, output: 1000 }, SOL)).toBeCloseTo(1.103)
  })

  it('adds requests priced apart, so a run of small ones never reads as one long prompt', async () => {
    const reply = (kind: 'tool' | 'answer'): ModelReply =>
      kind === 'tool'
        ? { kind: 'tool-calls', calls: [{ id: 'a', name: 'x', args: {} }], raw: [], tokens: { input: 60_000, cacheRead: 0, cacheWrite: 0, output: 0 } }
        : { kind: 'answer', text: 'done', raw: [], tokens: { input: 60_000, cacheRead: 0, cacheWrite: 0, output: 0 } }
    const replies = [reply('tool'), reply('answer')]
    const model: ModelPort = { model: { name: 'Haiku', price: HAIKU }, readsPdf: false, send: async () => replies.shift()! }
    const end = await runModelLoop({
      model,
      system: [],
      turns: [],
      tools: [],
      runTool: async () => ({ text: '', parts: [], isError: false }),
      effort: 'low',
      rounds: 2,
    })
    // Two requests of 60,000 at $0.10 a million, under the step each, not 120,000 at five times.
    expect(end.usage?.dollars).toBeCloseTo(0.012)
  })
})

const SONNET = PROVIDER_PRESETS.flatMap((preset) => preset.models).find((model) => model.id === 'claude-sonnet-5-5')!.price!

describe('what a document weighs and costs', () => {
  it('weighs a photo by 28-pixel squares, up to the most Anthropic counts', () => {
    // The receipt size Kuna sends, 1,120 by 1,600: 40 squares by 58 (1,600 / 28 is 57.1, rounded up).
    expect(documentTokens({ kind: 'photo', width: 1120, height: 1600 })).toBe(2320)
    expect(documentTokens({ kind: 'photo', width: 8000, height: 8000 })).toBe(4784)
  })

  it("weighs a PDF page at the top of Anthropic's range", () => {
    expect(documentTokens({ kind: 'pdf', pages: 6 })).toBe(30_000)
  })

  it('prices the read as a cache write and each later request as a cache read', () => {
    // 30,000 tokens at Sonnet's $2.50 a million to write is $0.075, and at $0.10 to read is $0.003.
    const cost = costOfDocument({ kind: 'pdf', pages: 6 }, SONNET, 4_000)
    expect(cost.toRead).toBeCloseTo(0.075)
    expect(cost.eachLaterRequest).toBeCloseTo(0.003)
  })

  it("counts Haiku's dearer rate on the whole prompt when the document takes it over 100,000 tokens", () => {
    // Under the step, 80,000 cached tokens cost $0.0008. Over it, they cost five times that, $0.004, and the
    // 30,000 written cost $0.01875 instead of $0.00375. The read adds $0.004 - $0.0008 + $0.01875.
    expect(costOfDocument({ kind: 'pdf', pages: 6 }, HAIKU, 80_000).toRead).toBeCloseTo(0.02195)
  })
})

describe('the loop with a tool result that carries a photo', () => {
  it('masks the text and sends the photo untouched', async () => {
    const sent: unknown[] = []
    const photo = { kind: 'image' as const, base64: 'A'.repeat(1_200_000), mediaType: 'image/jpeg' as const, width: 280, height: 280 }
    const replies: ModelReply[] = [
      { kind: 'tool-calls', calls: [{ id: 'a', name: 'read_attachment', args: {} }], raw: [], tokens: { input: 10, cacheRead: 0, cacheWrite: 0, output: 0 } },
      { kind: 'answer', text: 'done', raw: [], tokens: { input: 10, cacheRead: 0, cacheWrite: 0, output: 0 } },
    ]
    const model: ModelPort = {
      model: { name: 'Haiku', price: HAIKU },
      readsPdf: true,
      send: async (request) => {
        sent.push(request.turns.at(-1))
        return replies.shift()!
      },
    }
    const end = await runModelLoop({
      model,
      system: [],
      turns: [],
      tools: [],
      runTool: async () => ({ text: 'Paid from HR1723600001101234565.', parts: [photo], isError: false }),
      effort: 'low',
      rounds: 2,
    })
    expect(end.kind).toBe('answer')
    expect(sent[1]).toEqual({ role: 'tool-results', results: [{ callId: 'a', text: expect.not.stringContaining('HR1723600001101234565') as unknown, parts: [photo], isError: false }] })
  })
})
