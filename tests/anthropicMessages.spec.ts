import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ModelRequest } from '../src/shared/ai/application/modelPort'
import { ModelRequestFailed } from '../src/shared/ai/application/modelPort'
import { runTask } from '../src/shared/ai/application/runTask'
import type { AiTask } from '../src/shared/ai/domain/aiTask'
import type { StrictSchema } from '../src/shared/ai/domain/strictSchema'
import { anthropicMessages, testAnthropicKey } from '../src/shared/ai/infrastructure/anthropicMessages'
import type { ModelChoice } from '../src/shared/ai/infrastructure/providerPresets'

const KEY = 'made-up-anthropic-key-0042'
const SONNET: ModelChoice = { id: 'claude-sonnet-5-5', name: 'Sonnet 5.5', inputPerMillion: 2, outputPerMillion: 10 }

interface SentRequest {
  readonly url: string
  readonly method: string
  readonly headers: Readonly<Record<string, string>>
  readonly body: Record<string, unknown>
}

function stubFetch(...answers: Response[]): SentRequest[] {
  const requests: SentRequest[] = []
  vi.stubGlobal('fetch', async (input: string, init: RequestInit) => {
    requests.push({ url: input, method: init.method ?? 'GET', headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) as Record<string, unknown> })
    const answer = answers.shift()
    if (answer === undefined) throw new Error('The test sent more requests than it answers.')
    return answer
  })
  return requests
}

afterEach(() => {
  vi.unstubAllGlobals()
})

const CATEGORY_SCHEMA: StrictSchema = {
  type: 'object',
  properties: { category: { type: 'string', enum: ['office', 'travel'] } },
  required: ['category'],
  additionalProperties: false,
}

const RULE_INPUT: StrictSchema = { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false }

const THINKING_BLOCK = { type: 'thinking', thinking: '', signature: 'EqQBCkgIBhABGAIiQGQ2made-up-signature' }

const TOOL_USE_CONTENT = [
  THINKING_BLOCK,
  { type: 'text', text: 'I will look up both rules.' },
  { type: 'tool_use', id: 'toolu_01A9q4Rm', name: 'rule', input: { id: 'pdv-25' } },
  { type: 'tool_use', id: 'toolu_01B7xKp2', name: 'rule', input: { id: 'pdv-13' } },
]

function message(fields: Record<string, unknown>): Response {
  return Response.json({
    id: 'msg_01XFDUDYJgAACzvnptvVoYEL',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-5-5',
    stop_sequence: null,
    stop_details: null,
    usage: { input_tokens: 412, cache_creation_input_tokens: 1800, cache_read_input_tokens: 0, output_tokens: 96 },
    ...fields,
  })
}

function request(fields: Partial<ModelRequest> = {}): ModelRequest {
  return {
    system: [
      { kind: 'text', text: 'You sort bank rows into categories.' },
      { kind: 'text', text: 'Answer with the category only.' },
    ],
    turns: [{ role: 'user', parts: [{ kind: 'text', text: 'Row 4: Tisak, 3.20 EUR' }] }],
    output: CATEGORY_SCHEMA,
    tools: [],
    effort: 'low',
    ...fields,
  }
}

describe('the Anthropic Messages request', () => {
  it('posts to the Messages API with the key, the version and the header for calls from a browser', async () => {
    const requests = stubFetch(message({ content: [{ type: 'text', text: '{"category":"office"}' }], stop_reason: 'end_turn' }))

    await anthropicMessages(KEY, SONNET).send(request())

    expect(requests[0]!.url).toBe('https://api.anthropic.com/v1/messages')
    expect(requests[0]!.method).toBe('POST')
    expect(requests[0]!.headers).toEqual({
      'content-type': 'application/json',
      'x-api-key': KEY,
      'anthropic-version': '2026-10-21',
      'anthropic-dangerous-direct-browser-access': 'true',
    })
  })

  it('sends the schema as the output format with the effort, and no sampling, thinking, tools or beta', async () => {
    const requests = stubFetch(message({ content: [{ type: 'text', text: '{"category":"office"}' }], stop_reason: 'end_turn' }))

    await anthropicMessages(KEY, SONNET).send(request())

    const body = requests[0]!.body
    expect(body.model).toBe('claude-sonnet-5-5')
    expect(body.max_tokens).toBe(16000)
    expect(body.output_config).toEqual({ effort: 'low', format: { type: 'json_schema', schema: CATEGORY_SCHEMA } })
    expect(Object.keys(body).sort()).toEqual(['max_tokens', 'messages', 'model', 'output_config', 'system'])
    expect(Object.keys(requests[0]!.headers)).not.toContain('anthropic-beta')
  })

  it('marks only the last system block for the cache', async () => {
    const requests = stubFetch(message({ content: [{ type: 'text', text: '{"category":"office"}' }], stop_reason: 'end_turn' }))

    await anthropicMessages(KEY, SONNET).send(request())

    expect(requests[0]!.body.system).toEqual([
      { type: 'text', text: 'You sort bank rows into categories.' },
      { type: 'text', text: 'Answer with the category only.', cache_control: { type: 'ephemeral' } },
    ])
  })

  it('sends each task tool as a strict tool with an automatic choice, and no server tool', async () => {
    const requests = stubFetch(message({ content: [{ type: 'text', text: '{"category":"office"}' }], stop_reason: 'end_turn' }))

    await anthropicMessages(KEY, SONNET).send(request({ tools: [{ name: 'rule', description: 'Reads one rule by its id.', input: RULE_INPUT }] }))

    expect(requests[0]!.body.tools).toEqual([{ name: 'rule', description: 'Reads one rule by its id.', input_schema: RULE_INPUT, strict: true }])
    expect(requests[0]!.body.tool_choice).toEqual({ type: 'auto' })
  })

  it('turns the parts of a user turn into text, document and image blocks in their order', async () => {
    const requests = stubFetch(message({ content: [{ type: 'text', text: '{"category":"office"}' }], stop_reason: 'end_turn' }))

    await anthropicMessages(KEY, SONNET).send(
      request({
        turns: [
          {
            role: 'user',
            parts: [
              { kind: 'text', text: 'Read this offer.' },
              { kind: 'pdf', base64: 'JVBERi0xLjcK', name: 'offer.pdf' },
              { kind: 'image', base64: '/9j/4AAQSkZJRg==', mediaType: 'image/jpeg' },
            ],
          },
        ],
      }),
    )

    expect(requests[0]!.body.messages).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Read this offer.' },
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: 'JVBERi0xLjcK' }, title: 'offer.pdf' },
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: '/9j/4AAQSkZJRg==' } },
        ],
      },
    ])
  })

  it('sends an assistant turn back exactly as it came, thinking included, and the results of one round in one user message', async () => {
    const requests = stubFetch(message({ content: [{ type: 'text', text: '{"category":"office"}' }], stop_reason: 'end_turn' }))

    await anthropicMessages(KEY, SONNET).send(
      request({
        turns: [
          { role: 'user', parts: [{ kind: 'text', text: 'Which rate applies?' }] },
          { role: 'assistant', calls: [], raw: TOOL_USE_CONTENT },
          {
            role: 'tool-results',
            results: [
              { callId: 'toolu_01A9q4Rm', text: 'PDV is 25 percent.', isError: false },
              { callId: 'toolu_01B7xKp2', text: 'There is no rule pdv-13.', isError: true },
            ],
          },
        ],
      }),
    )

    const sent = requests[0]!.body.messages as unknown[]
    expect(sent).toHaveLength(3)
    expect(sent[1]).toEqual({ role: 'assistant', content: TOOL_USE_CONTENT })
    expect(sent[2]).toEqual({
      role: 'user',
      content: [
        { type: 'tool_result', tool_use_id: 'toolu_01A9q4Rm', content: 'PDV is 25 percent.', is_error: false },
        { type: 'tool_result', tool_use_id: 'toolu_01B7xKp2', content: 'There is no rule pdv-13.', is_error: true },
      ],
    })
  })
})

describe('the Anthropic Messages reply', () => {
  it('reads an end_turn as the answer from its text blocks, with every input token counted, cached ones too', async () => {
    stubFetch(
      message({
        content: [THINKING_BLOCK, { type: 'text', text: '{"category":' }, { type: 'text', text: '"office"}' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 40, cache_creation_input_tokens: 1200, cache_read_input_tokens: 3000, output_tokens: 18 },
      }),
    )

    expect(await anthropicMessages(KEY, SONNET).send(request())).toEqual({ kind: 'answer', text: '{"category":"office"}', tokens: { input: 4240, output: 18 } })
  })

  it('reads a tool_use as the calls to run, keeping the whole content to send back', async () => {
    stubFetch(message({ content: TOOL_USE_CONTENT, stop_reason: 'tool_use' }))

    expect(await anthropicMessages(KEY, SONNET).send(request())).toEqual({
      kind: 'tool-calls',
      calls: [
        { id: 'toolu_01A9q4Rm', name: 'rule', args: { id: 'pdv-25' } },
        { id: 'toolu_01B7xKp2', name: 'rule', args: { id: 'pdv-13' } },
      ],
      raw: TOOL_USE_CONTENT,
      tokens: { input: 2212, output: 96 },
    })
  })

  it('reads a refusal with its explanation, before it reads any content', async () => {
    stubFetch(
      message({
        content: [],
        stop_reason: 'refusal',
        stop_details: { type: 'refusal', category: 'cyber', explanation: 'This request looks like it asks for help with malware.' },
      }),
    )

    expect(await anthropicMessages(KEY, SONNET).send(request())).toEqual({
      kind: 'refused',
      reason: 'This request looks like it asks for help with malware.',
      tokens: { input: 2212, output: 96 },
    })
  })

  it('reads a refusal without details as one with an empty reason', async () => {
    stubFetch(message({ content: [], stop_reason: 'refusal', stop_details: null }))

    expect(await anthropicMessages(KEY, SONNET).send(request())).toMatchObject({ kind: 'refused', reason: '' })
  })

  it('reads max_tokens and a full context window as an answer cut off', async () => {
    stubFetch(
      message({ content: [{ type: 'text', text: '{"category":"off' }], stop_reason: 'max_tokens' }),
      message({ content: [{ type: 'text', text: '{"cat' }], stop_reason: 'model_context_window_exceeded' }),
    )
    const model = anthropicMessages(KEY, SONNET)

    expect(await model.send(request())).toEqual({ kind: 'cut-off', tokens: { input: 2212, output: 96 } })
    expect(await model.send(request())).toMatchObject({ kind: 'cut-off' })
  })

  it('fails on a stop reason it does not know', async () => {
    stubFetch(message({ content: [], stop_reason: 'pause_turn' }))

    await expect(anthropicMessages(KEY, SONNET).send(request())).rejects.toMatchObject({ name: 'ModelRequestFailed', status: 200 })
  })
})

describe('an Anthropic Messages request that fails', () => {
  it('reports a refused key with the message from the error body', async () => {
    stubFetch(
      Response.json({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' }, request_id: 'req_011CgifHEAe5J2jo5cY7L5SC' }, { status: 401, statusText: 'Unauthorized' }),
    )

    const failure = await anthropicMessages(KEY, SONNET)
      .send(request())
      .catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(ModelRequestFailed)
    expect(failure).toMatchObject({ status: 401, message: 'invalid x-api-key' })
  })

  it('reports an overloaded provider with its status and message', async () => {
    stubFetch(Response.json({ type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' }, request_id: 'req_011CgjQ2b8wL' }, { status: 529 }))

    await expect(anthropicMessages(KEY, SONNET).send(request())).rejects.toMatchObject({ name: 'ModelRequestFailed', status: 529, message: 'Overloaded' })
  })

  it('falls back to the status text when the error body is not JSON', async () => {
    stubFetch(new Response('<html>Bad gateway</html>', { status: 502, statusText: 'Bad Gateway' }))

    await expect(anthropicMessages(KEY, SONNET).send(request())).rejects.toMatchObject({ status: 502, message: 'Bad Gateway' })
  })

  it('reports a request that never reached the provider with status 0', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')))

    await expect(anthropicMessages(KEY, SONNET).send(request())).rejects.toMatchObject({ name: 'ModelRequestFailed', status: 0, message: 'Failed to fetch' })
  })
})

describe('the Anthropic key test', () => {
  it('counts the tokens of one word with the same headers, and nothing from the books', async () => {
    const requests = stubFetch(Response.json({ input_tokens: 8 }))

    expect(await testAnthropicKey(KEY, 'claude-haiku-5-5')).toEqual({ kind: 'works' })
    expect(requests[0]!.url).toBe('https://api.anthropic.com/v1/messages/count_tokens')
    expect(requests[0]!.method).toBe('POST')
    expect(requests[0]!.headers['anthropic-dangerous-direct-browser-access']).toBe('true')
    expect(requests[0]!.headers['x-api-key']).toBe(KEY)
    expect(requests[0]!.body).toEqual({ model: 'claude-haiku-5-5', messages: [{ role: 'user', content: 'Hi' }] })
  })

  it('says a key Anthropic turns away is refused', async () => {
    stubFetch(
      Response.json({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }, { status: 401 }),
      Response.json({ type: 'error', error: { type: 'permission_error', message: 'This key cannot use this model.' } }, { status: 403 }),
    )

    expect(await testAnthropicKey(KEY, 'claude-haiku-5-5')).toEqual({ kind: 'refused' })
    expect(await testAnthropicKey(KEY, 'claude-haiku-5-5')).toEqual({ kind: 'refused' })
  })

  it('says the test failed, with the reason, on any other status or when Anthropic cannot be reached', async () => {
    stubFetch(Response.json({ type: 'error', error: { type: 'rate_limit_error', message: 'Number of requests has exceeded your rate limit.' } }, { status: 429 }))

    expect(await testAnthropicKey(KEY, 'claude-haiku-5-5')).toEqual({ kind: 'failed', reason: 'Number of requests has exceeded your rate limit.' })

    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')))
    expect(await testAnthropicKey(KEY, 'claude-haiku-5-5')).toEqual({ kind: 'failed', reason: 'Failed to fetch' })
  })
})

describe('a task run over the Anthropic adapter', () => {
  const ANSWER_SCHEMA: StrictSchema = {
    type: 'object',
    properties: { rate: { type: 'integer' }, rule: { type: 'string' } },
    required: ['rate', 'rule'],
    additionalProperties: false,
  }

  const task: AiTask<string, { readonly rate: number; readonly rule: string }> = {
    id: 'company.vat-rate',
    app: 'company',
    effort: 'medium',
    system: () => [{ kind: 'text', text: 'You answer which VAT rate applies, citing the rule.' }],
    input: (question) => [{ kind: 'text', text: question }],
    output: () => ANSWER_SCHEMA,
    tools: [
      {
        name: 'rule',
        description: 'Reads one rule by its id.',
        input: RULE_INPUT,
        run: async () => ({ text: 'Rule pdv-25: the standard rate is 25 percent.', sources: ['pdv-25'], figures: [] }),
      },
    ],
    check: (output) => ({ draft: output as { rate: number; rule: string }, problems: [] }),
  }

  it('runs one tool round, then turns the answer into a draft with the usage of both requests', async () => {
    const firstContent = [THINKING_BLOCK, { type: 'tool_use', id: 'toolu_01A9q4Rm', name: 'rule', input: { id: 'pdv-25' } }]
    const requests = stubFetch(
      message({ content: firstContent, stop_reason: 'tool_use', usage: { input_tokens: 300, cache_creation_input_tokens: 1700, cache_read_input_tokens: 0, output_tokens: 80 } }),
      message({
        content: [THINKING_BLOCK, { type: 'text', text: '{"rate":25,"rule":"pdv-25"}' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 120, cache_creation_input_tokens: 0, cache_read_input_tokens: 1700, output_tokens: 20 },
      }),
    )

    const result = await runTask(task, 'Which VAT rate applies to office chairs?', { model: anthropicMessages(KEY, SONNET), appOn: true, employees: { sends: false, on: false } })

    expect(result).toEqual({
      kind: 'draft',
      draft: { rate: 25, rule: 'pdv-25' },
      problems: [],
      usage: { model: 'Sonnet 5.5', inputTokens: 3820, outputTokens: 100, dollars: (3820 * 2 + 100 * 10) / 1_000_000 },
    })
    expect(requests).toHaveLength(2)
    expect(requests[1]!.body.messages).toEqual([
      { role: 'user', content: [{ type: 'text', text: 'Which VAT rate applies to office chairs?' }] },
      { role: 'assistant', content: firstContent },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_01A9q4Rm', content: 'Rule pdv-25: the standard rate is 25 percent.', is_error: false }] },
    ])
  })
})

describe('a reply off the shape the Messages API documents', () => {
  it.each([
    ['no content', { stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } }],
    ['no usage', { stop_reason: 'end_turn', content: [] }],
    ['usage without tokens', { stop_reason: 'end_turn', content: [], usage: {} }],
  ])('fails as a failed request with %s', async (_name, reply) => {
    stubFetch(Response.json(reply))
    await expect(anthropicMessages(KEY, SONNET).send(request())).rejects.toBeInstanceOf(ModelRequestFailed)
  })

  it('keeps the tokens of a stop reason it does not know', async () => {
    stubFetch(message({ content: [], stop_reason: 'something_new' }))
    const failure = await anthropicMessages(KEY, SONNET)
      .send(request())
      .catch((error: unknown) => error)
    expect(failure).toMatchObject({ status: 200, tokens: { input: 2212, output: 96 } })
  })
})

describe('an aborted Messages request', () => {
  it('hands fetch the signal, and fails with the reason it was aborted for', async () => {
    vi.stubGlobal('fetch', (_input: string, init: RequestInit) => {
      expect(init.signal).toBeInstanceOf(AbortSignal)
      return new Promise((_resolve, reject) => {
        init.signal!.addEventListener('abort', () => reject(init.signal!.reason as Error))
      })
    })
    const controller = new AbortController()
    const sending = anthropicMessages(KEY, SONNET).send(request({ signal: controller.signal }))
    controller.abort(new Error('Too slow.'))
    await expect(sending).rejects.toMatchObject({ status: 0, message: 'Too slow.' })
  })
})
