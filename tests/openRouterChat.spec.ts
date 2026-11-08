import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ModelRequest } from '../src/shared/ai/application/modelPort'
import { ModelRequestFailed } from '../src/shared/ai/application/modelPort'
import { runModelLoop } from '../src/shared/ai/application/runModelLoop'
import { runTask } from '../src/shared/ai/application/runTask'
import type { AiTask } from '../src/shared/ai/domain/aiTask'
import type { StrictSchema } from '../src/shared/ai/domain/strictSchema'
import { bearerHeaders, keyTestOf } from '../src/shared/ai/infrastructure/providerFetch'
import { openRouterChat } from '../src/shared/ai/infrastructure/openRouterChat'
import type { ModelChoice } from '../src/shared/ai/domain/providerPresets'
import { streamCutByAbort } from './support/sseResponse'

const KEY = 'made-up-openrouter-key-0042'
const BASE_URL = 'https://openrouter.ai/api/v1'
const SOL_PRICE = { inputPerMillion: 2, cacheReadPerMillion: 0.1, cacheWritePerMillion: 2.5, outputPerMillion: 10 }
const SOL: ModelChoice = { id: 'openai/gpt-6.1-sol', name: 'GPT-6.1 Sol', price: SOL_PRICE }

interface SentRequest {
  readonly url: string
  readonly method: string
  readonly headers: Readonly<Record<string, string>>
  readonly body: Record<string, unknown> | null
}

function stubFetch(...answers: Response[]): SentRequest[] {
  const requests: SentRequest[] = []
  vi.stubGlobal('fetch', async (input: string, init: RequestInit) => {
    const body = init.body === undefined ? null : (JSON.parse(String(init.body)) as Record<string, unknown>)
    requests.push({ url: input, method: init.method ?? 'GET', headers: init.headers as Record<string, string>, body })
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

function completion(finishReason: string, message: Record<string, unknown>, usage: Record<string, unknown> = { prompt_tokens: 812, completion_tokens: 64, total_tokens: 876 }): Response {
  return Response.json({
    id: 'chatcmpl-CfQ8made-up',
    object: 'chat.completion',
    created: 1793833200,
    model: 'openai/gpt-6.1-sol',
    choices: [{ index: 0, message: { role: 'assistant', content: null, refusal: null, annotations: [], ...message }, logprobs: null, finish_reason: finishReason }],
    usage,
  })
}

function functionCall(id: string, name: string, args: string): Record<string, unknown> {
  return { id, type: 'function', function: { name, arguments: args } }
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

const WITH_TOOLS: Partial<ModelRequest> = { tools: [{ name: 'rule', description: 'Reads one rule by its id.', input: RULE_INPUT }] }

describe('the Chat Completions request', () => {
  it('posts to the base address with the bearer key, and joins the system parts into one message', async () => {
    const requests = stubFetch(completion('stop', { content: '{"category":"office"}' }))

    await openRouterChat(BASE_URL, KEY, SOL).send(request())

    expect(requests[0]!.url).toBe('https://openrouter.ai/api/v1/chat/completions')
    expect(requests[0]!.method).toBe('POST')
    expect(requests[0]!.headers).toEqual({ authorization: `Bearer ${KEY}`, 'content-type': 'application/json' })
    expect(requests[0]!.body!.model).toBe('openai/gpt-6.1-sol')
    expect(requests[0]!.body!.max_completion_tokens).toBe(16000)
    expect(requests[0]!.body!.messages).toEqual([
      { role: 'system', content: 'You sort bank rows into categories.\n\nAnswer with the category only.' },
      { role: 'user', content: [{ type: 'text', text: 'Row 4: Tisak, 3.20 EUR' }] },
    ])
  })

  it('asks for the schema as a strict response format when the task has no tools', async () => {
    const requests = stubFetch(completion('stop', { content: '{"category":"office"}' }))

    await openRouterChat(BASE_URL, KEY, SOL).send(request())

    expect(requests[0]!.body!.response_format).toEqual({ type: 'json_schema', json_schema: { name: 'answer', strict: true, schema: CATEGORY_SCHEMA } })
    expect(Object.keys(requests[0]!.body!).sort()).toEqual(['max_completion_tokens', 'messages', 'model', 'provider', 'response_format'])
  })

  it('sends strict functions and a last answer function with the schema, without a response format, when the task has tools', async () => {
    const requests = stubFetch(completion('stop', { content: '{"category":"office"}' }))

    await openRouterChat(BASE_URL, KEY, SOL).send(request(WITH_TOOLS))

    const body = requests[0]!.body!
    expect(body.response_format).toBeUndefined()
    expect(body.tool_choice).toBe('auto')
    const tools = body.tools as { type: string; function: { name: string; description: string; parameters: unknown; strict: boolean } }[]
    expect(tools).toHaveLength(2)
    expect(tools[0]).toEqual({ type: 'function', function: { name: 'rule', description: 'Reads one rule by its id.', parameters: RULE_INPUT, strict: true } })
    expect(tools[1]!.function).toMatchObject({ name: 'answer', parameters: CATEGORY_SCHEMA, strict: true })
    expect(tools[1]!.function.description).toContain('final answer')
    expect(Object.keys(body)).not.toContain('temperature')
  })

  it('sends a photo as an image part', async () => {
    const requests = stubFetch(completion('stop', { content: '{"category":"office"}' }))

    await openRouterChat(BASE_URL, KEY, SOL).send(
      request({
        turns: [
          {
            role: 'user',
            parts: [
              { kind: 'text', text: 'Read this offer.' },
              { kind: 'image', base64: '/9j/4AAQSkZJRg==', mediaType: 'image/jpeg', width: 1120, height: 1600 },
            ],
          },
        ],
      }),
    )

    expect((requests[0]!.body!.messages as unknown[])[1]).toEqual({
      role: 'user',
      content: [
        { type: 'text', text: 'Read this offer.' },
        { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==' } },
      ],
    })
  })

  it('sends an assistant turn back as its own message, and each tool result as its own tool message', async () => {
    const assistant = {
      role: 'assistant',
      content: null,
      refusal: null,
      annotations: [],
      tool_calls: [functionCall('call_Qm3x', 'rule', '{"id":"pdv-25"}'), functionCall('call_Zt8k', 'rule', '{"id":"pdv-13"}')],
    }
    const requests = stubFetch(completion('stop', { content: '{"category":"office"}' }))

    await openRouterChat(BASE_URL, KEY, SOL).send(
      request({
        ...WITH_TOOLS,
        turns: [
          { role: 'user', parts: [{ kind: 'text', text: 'Which rate applies?' }] },
          { role: 'assistant', calls: [], raw: assistant },
          {
            role: 'tool-results',
            results: [
              { callId: 'call_Qm3x', text: 'PDV is 25 percent.', parts: [], isError: false },
              { callId: 'call_Zt8k', text: 'There is no rule pdv-13.', parts: [], isError: true },
            ],
          },
        ],
      }),
    )

    expect((requests[0]!.body!.messages as unknown[]).slice(2)).toEqual([
      assistant,
      { role: 'tool', tool_call_id: 'call_Qm3x', content: 'PDV is 25 percent.' },
      { role: 'tool', tool_call_id: 'call_Zt8k', content: 'Error: There is no rule pdv-13.' },
    ])
  })

  it('sends a tool result with a photo as a list, its envelope first, and one with text only as a string', async () => {
    const requests = stubFetch(completion('stop', { content: 'Read.' }))

    await openRouterChat(BASE_URL, KEY, SOL).send(
      request({
        ...WITH_TOOLS,
        turns: [
          { role: 'user', parts: [{ kind: 'text', text: 'Read my receipt.' }] },
          { role: 'assistant', calls: [], raw: { role: 'assistant', content: null } },
          {
            role: 'tool-results',
            results: [
              { callId: 'call_a1', text: '{"id":"a1","kind":"photo"}', parts: [{ kind: 'image', base64: '/9j/4AAQSkZJRg==', mediaType: 'image/jpeg', width: 1120, height: 1600 }], isError: false },
              { callId: 'call_a3', text: 'There is no attachment a3.', parts: [], isError: true },
            ],
          },
        ],
      }),
    )

    expect((requests[0]!.body!.messages as unknown[]).slice(3)).toEqual([
      {
        role: 'tool',
        tool_call_id: 'call_a1',
        content: [
          { type: 'text', text: '{"id":"a1","kind":"photo"}' },
          { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==' } },
        ],
      },
      { role: 'tool', tool_call_id: 'call_a3', content: 'Error: There is no attachment a3.' },
    ])
  })

  it('sends nothing when a tool result holds a PDF', async () => {
    const requests = stubFetch()

    const failure = await openRouterChat(BASE_URL, KEY, SOL)
      .send(
        request({
          ...WITH_TOOLS,
          turns: [
            { role: 'user', parts: [{ kind: 'text', text: 'Read the offer.' }] },
            { role: 'assistant', calls: [], raw: { role: 'assistant', content: null } },
            { role: 'tool-results', results: [{ callId: 'call_a2', text: '{"id":"a2","kind":"pdf"}', parts: [{ kind: 'pdf', base64: 'JVBERi0xLjcK', name: 'a2' }], isError: false }] },
          ],
        }),
      )
      .catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(ModelRequestFailed)
    expect(requests).toEqual([])
  })
})

describe('the Chat Completions reply', () => {
  it('reads stop as the answer, with the tokens from the usage', async () => {
    stubFetch(completion('stop', { content: '{"category":"office"}' }))

    expect(await openRouterChat(BASE_URL, KEY, SOL).send(request())).toMatchObject({ kind: 'answer', text: '{"category":"office"}', tokens: { input: 812, cacheRead: 0, cacheWrite: 0, output: 64 } })
  })

  it('reads stop with a refusal as refused, with the refusal text', async () => {
    stubFetch(completion('stop', { refusal: 'I cannot help with that request.' }))

    expect(await openRouterChat(BASE_URL, KEY, SOL).send(request())).toEqual({
      kind: 'refused',
      reason: 'I cannot help with that request.',
      tokens: { input: 812, cacheRead: 0, cacheWrite: 0, output: 64 },
    })
  })

  it('reads tool_calls as the calls to run, with their arguments parsed and the message kept to send back', async () => {
    const toolCalls = [functionCall('call_Qm3x', 'rule', '{"id":"pdv-25"}'), functionCall('call_Zt8k', 'rule', '{"id": "pdv-')]
    stubFetch(completion('tool_calls', { tool_calls: toolCalls }))

    const reply = await openRouterChat(BASE_URL, KEY, SOL).send(request(WITH_TOOLS))

    expect(reply).toEqual({
      kind: 'tool-calls',
      calls: [
        { id: 'call_Qm3x', name: 'rule', args: { id: 'pdv-25' } },
        { id: 'call_Zt8k', name: 'rule', args: undefined },
      ],
      raw: { role: 'assistant', content: null, refusal: null, annotations: [], tool_calls: toolCalls },
      tokens: { input: 812, cacheRead: 0, cacheWrite: 0, output: 64 },
    })
  })

  it('reads a call to the answer function as the answer, with its arguments as the text', async () => {
    stubFetch(completion('tool_calls', { tool_calls: [functionCall('call_Ans1', 'answer', '{"category":"travel"}')] }))

    expect(await openRouterChat(BASE_URL, KEY, SOL).send(request(WITH_TOOLS))).toMatchObject({
      kind: 'answer',
      text: '{"category":"travel"}',
      tokens: { input: 812, cacheRead: 0, cacheWrite: 0, output: 64 },
    })
  })

  it('reads length as an answer cut off and content_filter as refused', async () => {
    stubFetch(completion('length', { content: '{"categ' }), completion('content_filter', { content: null }))
    const model = openRouterChat(BASE_URL, KEY, SOL)

    expect(await model.send(request())).toEqual({ kind: 'cut-off', tokens: { input: 812, cacheRead: 0, cacheWrite: 0, output: 64 } })
    expect(await model.send(request())).toEqual({ kind: 'refused', reason: 'content_filter', tokens: { input: 812, cacheRead: 0, cacheWrite: 0, output: 64 } })
  })

  it('fails on a finish reason it does not know', async () => {
    stubFetch(completion('function_call', { content: null }))

    await expect(openRouterChat(BASE_URL, KEY, SOL).send(request())).rejects.toMatchObject({ name: 'ModelRequestFailed', status: 200 })
  })

  it('reads no PDF and shows its price', () => {
    const model = openRouterChat(BASE_URL, KEY, SOL)
    expect(model.readsPdf).toBe(false)
    expect(model.model.price).toEqual(SOL_PRICE)
  })

  it('splits the prompt tokens into fresh, cache read and cache write', async () => {
    stubFetch(
      completion(
        'stop',
        { content: '{"category":"office"}' },
        { prompt_tokens: 5200, completion_tokens: 64, total_tokens: 5264, prompt_tokens_details: { cached_tokens: 3000, cache_write_tokens: 1800 } },
      ),
    )
    expect(await openRouterChat(BASE_URL, KEY, SOL).send(request())).toMatchObject({ tokens: { input: 400, cacheRead: 3000, cacheWrite: 1800, output: 64 } })
  })

  it('keeps what OpenRouter says it charged, and a whole run shows it instead of the list price', async () => {
    const usage = { prompt_tokens: 900, completion_tokens: 40, total_tokens: 940, cost: 0.0123 }
    stubFetch(
      completion('tool_calls', { tool_calls: [functionCall('call_a', 'rule', '{"id":"pdv-25"}')] }, usage),
      completion('tool_calls', { tool_calls: [functionCall('call_b', 'answer', '{"category":"office"}')] }, { ...usage, cost: 0.0077 }),
    )
    const typed: ModelChoice = { id: 'made-up/model', name: 'made-up/model', price: null }
    const task: AiTask<null, unknown> = {
      id: 'test.charged',
      app: 'test',
      effort: 'low',
      system: () => [],
      input: () => [{ kind: 'text', text: 'Row' }],
      output: () => CATEGORY_SCHEMA,
      tools: [{ name: 'rule', description: 'Reads one rule.', input: RULE_INPUT, run: async () => ({ text: 'A rule.', sources: [], figures: [] }) }],
      check: (output) => ({ draft: output, problems: [] }),
    }
    const result = await runTask(task, null, { model: openRouterChat(BASE_URL, KEY, typed), appOn: true, employees: { sends: false, anonymising: true } })
    expect(result).toMatchObject({ kind: 'draft', usage: { dollars: 0.0123 + 0.0077 } })
  })

  it('reports no charge when a reply has none, which leaves the list price to the run', async () => {
    stubFetch(completion('length', {}, { prompt_tokens: 1000, completion_tokens: 100, total_tokens: 1100 }))
    expect(await openRouterChat(BASE_URL, KEY, SOL).send(request())).toEqual({ kind: 'cut-off', tokens: { input: 1000, cacheRead: 0, cacheWrite: 0, output: 100 } })
  })

  it('shows no cost line for a reply with no usage at all, rather than a cost of nothing', async () => {
    vi.stubGlobal('fetch', async () => Response.json({ choices: [{ finish_reason: 'length', message: { role: 'assistant', content: null } }] }))
    const end = await runModelLoop({
      model: openRouterChat(BASE_URL, KEY, SOL),
      system: [],
      turns: [],
      output: null,
      tools: [],
      runTool: () => Promise.reject(new Error('no tool here')),
      effort: 'low',
      limits: { rounds: 1, requestTokens: 1000, runTokens: 1000 },
    })
    expect(end).toEqual({ kind: 'cut-off', reason: '', usage: null })
  })

  it('says a timeout during a slow body as the timeout, not as a body that is not JSON', async () => {
    const controller = new AbortController()
    vi.stubGlobal('fetch', async () => streamCutByAbort('{"choices":', controller.signal))
    const sending = openRouterChat(BASE_URL, KEY, SOL).send(request({ signal: controller.signal }))
    setTimeout(() => controller.abort(new Error('Too slow.')), 10)
    await expect(sending).rejects.toMatchObject({ status: 0, message: 'Too slow.' })
  })

  it('offers no answer function and no format when a request asks for no schema', async () => {
    const requests = stubFetch(completion('stop', { content: 'Plain words.' }))
    await openRouterChat(BASE_URL, KEY, SOL).send(request({ ...WITH_TOOLS, output: null }))
    expect((requests[0]!.body!.tools as { function: { name: string } }[]).map((tool) => tool.function.name)).toEqual(['rule'])
    expect(requests[0]!.body!.response_format).toBeUndefined()
  })

  it('cuts the key out of what the provider says back', async () => {
    stubFetch(Response.json({ error: { message: `Bad key ${KEY}` } }, { status: 400 }))
    await expect(openRouterChat(BASE_URL, KEY, SOL).send(request())).rejects.toMatchObject({ message: 'Bad key [key]' })
  })
})

describe('a Chat Completions request that fails', () => {
  it('reports a refused key with the message from the error body', async () => {
    stubFetch(
      Response.json(
        { error: { message: 'Incorrect API key provided: made-up-***********0042.', type: 'invalid_request_error', param: null, code: 'invalid_api_key' } },
        { status: 401, statusText: 'Unauthorized' },
      ),
    )

    const failure = await openRouterChat(BASE_URL, KEY, SOL)
      .send(request())
      .catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(ModelRequestFailed)
    expect(failure).toMatchObject({ status: 401, message: 'Incorrect API key provided: made-up-***********0042.' })
  })

  it('reports a provider error with its status, and the status text when the body is not JSON', async () => {
    stubFetch(
      Response.json({ error: { message: 'The server is overloaded.', type: 'server_error', param: null, code: null } }, { status: 503 }),
      new Response('upstream connect error', { status: 502, statusText: 'Bad Gateway' }),
    )
    const model = openRouterChat(BASE_URL, KEY, SOL)

    await expect(model.send(request())).rejects.toMatchObject({ status: 503, message: 'The server is overloaded.' })
    await expect(model.send(request())).rejects.toMatchObject({ status: 502, message: 'Bad Gateway' })
  })

  it('reports a request that never reached the provider with status 0', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('NetworkError when attempting to fetch resource.')))

    await expect(openRouterChat(BASE_URL, KEY, SOL).send(request())).rejects.toMatchObject({
      name: 'ModelRequestFailed',
      status: 0,
      message: 'NetworkError when attempting to fetch resource.',
    })
  })
})

describe('the bearer key test', () => {
  it('lists the models with the bearer key and sends no body', async () => {
    const requests = stubFetch(Response.json({ object: 'list', data: [{ id: 'openai/gpt-6.1-sol', object: 'model', created: 1790000000, owned_by: 'openai' }] }))

    expect(await keyTestOf({ address: `${BASE_URL}/models`, method: 'GET', headers: bearerHeaders(KEY), key: KEY })).toEqual({ kind: 'works' })
    expect(requests[0]).toMatchObject({ url: 'https://openrouter.ai/api/v1/models', method: 'GET', body: null })
    expect(requests[0]!.headers.authorization).toBe(`Bearer ${KEY}`)
  })

  it('says a key the provider turns away is refused, and anything else failed with the reason', async () => {
    stubFetch(
      Response.json({ error: { message: 'Incorrect API key provided.', type: 'invalid_request_error', param: null, code: 'invalid_api_key' } }, { status: 401 }),
      Response.json({ error: { message: 'You are not allowed to list models.', type: 'invalid_request_error', param: null, code: null } }, { status: 403 }),
      Response.json({ error: { message: 'Rate limit reached for requests.', type: 'requests', param: null, code: 'rate_limit_exceeded' } }, { status: 429 }),
    )

    expect(await keyTestOf({ address: `${BASE_URL}/models`, method: 'GET', headers: bearerHeaders(KEY), key: KEY })).toEqual({ kind: 'refused' })
    expect(await keyTestOf({ address: `${BASE_URL}/models`, method: 'GET', headers: bearerHeaders(KEY), key: KEY })).toEqual({ kind: 'refused' })
    expect(await keyTestOf({ address: `${BASE_URL}/models`, method: 'GET', headers: bearerHeaders(KEY), key: KEY })).toEqual({ kind: 'failed', reason: 'Rate limit reached for requests.' })
  })

  it('says the test failed when the provider cannot be reached', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')))

    expect(await keyTestOf({ address: `${BASE_URL}/models`, method: 'GET', headers: bearerHeaders(KEY), key: KEY })).toEqual({ kind: 'failed', reason: 'Failed to fetch' })
  })
})

describe('a task run over the OpenRouter adapter', () => {
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

  it('runs one tool round, then turns the answer function into a draft with the usage of both requests', async () => {
    const lookup = functionCall('call_Qm3x', 'rule', '{"id":"pdv-25"}')
    const requests = stubFetch(
      completion('tool_calls', { tool_calls: [lookup] }, { prompt_tokens: 900, completion_tokens: 40, total_tokens: 940 }),
      completion('tool_calls', { tool_calls: [functionCall('call_Ans1', 'answer', '{"rate":25,"rule":"pdv-25"}')] }, { prompt_tokens: 980, completion_tokens: 30, total_tokens: 1010 }),
    )

    const result = await runTask(task, 'Which VAT rate applies to office chairs?', { model: openRouterChat(BASE_URL, KEY, SOL), appOn: true, employees: { sends: false, anonymising: true } })

    expect(result).toEqual({
      kind: 'draft',
      draft: { rate: 25, rule: 'pdv-25' },
      problems: [],
      usage: { model: 'GPT-6.1 Sol', inputTokens: 1880, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 70, dollars: (1880 * 2 + 70 * 10) / 1_000_000 },
    })
    expect(requests).toHaveLength(2)
    expect(requests[1]!.body!.messages).toEqual([
      { role: 'system', content: 'You answer which VAT rate applies, citing the rule.' },
      { role: 'user', content: [{ type: 'text', text: 'Which VAT rate applies to office chairs?' }] },
      { role: 'assistant', content: null, refusal: null, annotations: [], tool_calls: [lookup] },
      { role: 'tool', tool_call_id: 'call_Qm3x', content: 'Rule pdv-25: the standard rate is 25 percent.' },
    ])
  })
})

describe('a Chat Completions reply off the documented shape', () => {
  it.each([
    ['no choices', { usage: {} }],
    ['choices that are not a list', { choices: {} }],
    ['a choice with no message', { choices: [{ finish_reason: 'stop' }] }],
    ['a null message', { choices: [{ finish_reason: 'stop', message: null }] }],
  ])('fails as a failed request with %s', async (_name, reply) => {
    stubFetch(Response.json(reply))
    await expect(openRouterChat(BASE_URL, KEY, SOL).send(request())).rejects.toBeInstanceOf(ModelRequestFailed)
  })

  it('keeps the tokens of a finish reason it does not know', async () => {
    stubFetch(completion('function_call', { content: null }))
    const failure = await openRouterChat(BASE_URL, KEY, SOL)
      .send(request())
      .catch((error: unknown) => error)
    expect(failure).toMatchObject({ status: 200, tokens: { input: 812, cacheRead: 0, cacheWrite: 0, output: 64 } })
  })
})

describe('the routing of a Chat Completions request', () => {
  it('asks OpenRouter to route only to endpoints that honour every parameter and keep no prompts', async () => {
    const requests = stubFetch(completion('stop', { content: '{}' }))
    await openRouterChat(BASE_URL, KEY, SOL).send(request())
    expect(requests[0]!.body!.provider).toEqual({ require_parameters: true, data_collection: 'deny' })
  })

  it('hands fetch the signal', async () => {
    const seen: unknown[] = []
    vi.stubGlobal('fetch', async (_input: string, init: RequestInit) => {
      seen.push(init.signal)
      return completion('stop', { content: '{}' })
    })
    const { signal } = new AbortController()
    await openRouterChat(BASE_URL, KEY, SOL).send(request({ signal }))
    expect(seen).toEqual([signal])
  })
})
