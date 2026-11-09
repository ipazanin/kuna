import { describe, expect, it } from 'vitest'

import { SecretInRequest, guardedModel } from '../src/shared/ai/application/egressGuard'
import type { ModelPort, ModelRequest } from '../src/shared/ai/application/modelPort'
import { NO_TOKENS } from '../src/shared/ai/domain/modelUsage'

const CANARY = 'made-up-stored-secret-0042'

function modelNoting(name = 'Sonnet 5.5'): ModelPort & { readonly sent: ModelRequest[] } {
  const sent: ModelRequest[] = []
  return {
    sent,
    readsPdf: true,
    model: { name, price: null },
    async send(request) {
      sent.push(request)
      return { kind: 'cut-off', tokens: NO_TOKENS }
    },
  }
}

function requestWith(text: string, rest: Partial<ModelRequest> = {}): ModelRequest {
  return { system: [{ kind: 'text', text: 'Be brief.' }], turns: [{ role: 'user', parts: [{ kind: 'text', text }] }], tools: [], effort: 'low', ...rest }
}

async function refuses(model: ModelPort, request: ModelRequest, secrets: readonly string[] = [CANARY]): Promise<boolean> {
  try {
    await guardedModel(model, () => secrets).send(request)
    return false
  } catch (failure) {
    if (failure instanceof SecretInRequest) return true
    throw failure
  }
}

describe('the egress guard', () => {
  it('lets an ordinary request through', async () => {
    const model = modelNoting()
    expect(await refuses(model, requestWith('Row 4: Tisak, 3.20 EUR'))).toBe(false)
    expect(model.sent).toHaveLength(1)
  })

  it.each([
    ['the system text', requestWith('x', { system: [{ kind: 'text', text: `Key ${CANARY}` }] })],
    ['a user turn', requestWith(`Key ${CANARY}`)],
    ['a tool result', requestWith('x', { turns: [{ role: 'tool-results', results: [{ callId: 'a', text: `Key ${CANARY}`, parts: [], isError: false }] }] })],
    ['what an assistant turn replays', requestWith('x', { turns: [{ role: 'assistant', calls: [], raw: [{ type: 'text', text: CANARY }] }] })],
    ['a tool schema', requestWith('x', { tools: [{ name: 'look', title: 'Look', readOnly: true, description: 'Looks.', input: { type: 'string', enum: [CANARY] } }] })],
  ])('refuses a stored secret in %s and sends nothing', async (_where, request) => {
    const model = modelNoting()
    expect(await refuses(model, request)).toBe(true)
    expect(model.sent).toEqual([])
  })

  it.each([
    'sk-ant-api03-madeUpMadeUpMadeUpMadeUp',
    'sk-proj-madeUpMadeUpMadeUpMadeUp',
    'sk-or-v1-madeUpMadeUpMadeUpMadeUp',
    'sk-svcacct-madeUpMadeUpMadeUpMadeUp',
    'sk-madeUpMadeUpMadeUpMadeUp',
    `AIza${'m'.repeat(35)}`,
    'ya29.madeUpMadeUpMadeUpMadeUp',
  ])('refuses the shape of %s though no such secret is stored', async (shape) => {
    expect(await refuses(modelNoting(), requestWith(`Please use ${shape} for this.`), [])).toBe(true)
  })

  it('refuses a key typed in the model field, whose text leaves with every request', async () => {
    expect(await refuses(modelNoting('sk-ant-api03-madeUpMadeUpMadeUpMadeUp'), requestWith('x'), [])).toBe(true)
  })

  it('never says what it found', async () => {
    const failure = await guardedModel(modelNoting(), () => [CANARY])
      .send(requestWith(`Key ${CANARY}`))
      .catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(SecretInRequest)
    expect(String((failure as Error).message)).not.toContain(CANARY)
  })

  it('passes text that only names a prefix, and a stored value too short to be a key', async () => {
    expect(await refuses(modelNoting(), requestWith('Keys start with sk-ant- or AIza or ya29. as a rule, and Risk-or-no-risk-of-a-long-hyphenated-word stays.'), ['abc'])).toBe(false)
  })

  it('looks for shapes in no document, signature or encrypted reasoning, where they turn up by chance, but still for an exact secret', async () => {
    const chance = `AIza${'x'.repeat(40)}`
    const turns: ModelRequest['turns'] = [
      { role: 'user', parts: [{ kind: 'image', base64: chance, mediaType: 'image/jpeg', width: 1120, height: 1600 }] },
      {
        role: 'assistant',
        calls: [],
        raw: [
          { type: 'thinking', signature: chance },
          { type: 'reasoning', encrypted_content: chance },
        ],
      },
    ]
    expect(await refuses(modelNoting(), requestWith('x', { turns }), [])).toBe(false)
    expect(await refuses(modelNoting(), requestWith('x', { turns }), [chance])).toBe(true)
  })

  it('refuses a key in the envelope of a tool result that carries a photo, and reads no shape in the photo itself', async () => {
    const photo = { kind: 'image' as const, base64: `AIza${'x'.repeat(40)}`, mediaType: 'image/jpeg' as const, width: 1120, height: 1600 }
    const result = (text: string): ModelRequest['turns'] => [{ role: 'tool-results', results: [{ callId: 'a', text, parts: [photo], isError: false }] }]
    expect(await refuses(modelNoting(), requestWith('x', { turns: result('{"id":"a1","kind":"photo","note":"sk-ant-api03-madeUpMadeUpMadeUpMadeUp"}') }), [])).toBe(true)
    expect(await refuses(modelNoting(), requestWith('x', { turns: result('{"id":"a1","kind":"photo"}') }), [])).toBe(false)
  })

  it('turns away a request whatever else it asks, and reads a secret saved after it was built', async () => {
    const stored: string[] = []
    const guarded = guardedModel(modelNoting(), () => stored)
    await expect(guarded.send(requestWith(`Key ${CANARY}`))).resolves.toMatchObject({ kind: 'cut-off' })
    stored.push(CANARY)
    await expect(guarded.send(requestWith(`Key ${CANARY}`))).rejects.toBeInstanceOf(SecretInRequest)
  })
})
