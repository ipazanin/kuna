import { describe, expect, it } from 'vitest'

import { runModelLoop } from '../src/shared/ai/application/runModelLoop'
import type { ModelPort, ModelReply } from '../src/shared/ai/application/modelPort'
import { costOfRequest } from '../src/shared/ai/domain/modelUsage'
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
      output: null,
      tools: [],
      runTool: async () => ({ text: '', isError: false }),
      effort: 'low',
      limits: { rounds: 2, requestTokens: Number.POSITIVE_INFINITY, runTokens: Number.POSITIVE_INFINITY },
    })
    // Two requests of 60,000 at $0.10 a million, under the step each, not 120,000 at five times.
    expect(end.usage?.dollars).toBeCloseTo(0.012)
  })
})
