import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ModelRequest } from '../src/shared/ai/application/modelPort'
import { ModelRequestFailed } from '../src/shared/ai/application/modelPort'
import { runTask } from '../src/shared/ai/application/runTask'
import type { AiTask } from '../src/shared/ai/domain/aiTask'
import type { StrictSchema } from '../src/shared/ai/domain/strictSchema'
import { openAiCompatible, testOpenAiCompatibleKey } from '../src/shared/ai/infrastructure/openAiCompatible'
import { PROVIDER_PRESETS } from '../src/shared/ai/infrastructure/providerPresets'
import type { ModelChoice } from '../src/shared/ai/infrastructure/providerPresets'

const KEY = 'made-up-openai-key-0042'
const BASE_URL = 'https://api.openai.com/v1'
const SOL: ModelChoice = { id: 'gpt-6.1-sol', name: 'GPT-6.1 Sol', inputPerMillion: 2, outputPerMillion: 10 }

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

function completion(finishReason: string, message: Record<string, unknown>, usage = { prompt_tokens: 812, completion_tokens: 64, total_tokens: 876 }): Response {
  return Response.json({
    id: 'chatcmpl-CfQ8made-up',
    object: 'chat.completion',
    created: 1793833200,
    model: 'gpt-6.1-sol',
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

    await openAiCompatible(BASE_URL, KEY, SOL, true).send(request())

    expect(requests[0]!.url).toBe('https://api.openai.com/v1/chat/completions')
    expect(requests[0]!.method).toBe('POST')
    expect(requests[0]!.headers).toEqual({ authorization: `Bearer ${KEY}`, 'content-type': 'application/json' })
    expect(requests[0]!.body!.model).toBe('gpt-6.1-sol')
    expect(requests[0]!.body!.max_completion_tokens).toBe(16000)
    expect(requests[0]!.body!.messages).toEqual([
      { role: 'system', content: 'You sort bank rows into categories.\n\nAnswer with the category only.' },
      { role: 'user', content: [{ type: 'text', text: 'Row 4: Tisak, 3.20 EUR' }] },
    ])
  })

  it('asks for the schema as a strict response format when the task has no tools', async () => {
    const requests = stubFetch(completion('stop', { content: '{"category":"office"}' }))

    await openAiCompatible(BASE_URL, KEY, SOL, true).send(request())

    expect(requests[0]!.body!.response_format).toEqual({ type: 'json_schema', json_schema: { name: 'answer', strict: true, schema: CATEGORY_SCHEMA } })
    expect(Object.keys(requests[0]!.body!).sort()).toEqual(['max_completion_tokens', 'messages', 'model', 'response_format'])
  })

  it('sends strict functions and a last answer function with the schema, without a response format, when the task has tools', async () => {
    const requests = stubFetch(completion('stop', { content: '{"category":"office"}' }))

    await openAiCompatible(BASE_URL, KEY, SOL, true).send(request(WITH_TOOLS))

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

  it('sends a PDF as a file part and a photo as an image part', async () => {
    const requests = stubFetch(completion('stop', { content: '{"category":"office"}' }))

    await openAiCompatible(BASE_URL, KEY, SOL, true).send(
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

    expect((requests[0]!.body!.messages as unknown[])[1]).toEqual({
      role: 'user',
      content: [
        { type: 'text', text: 'Read this offer.' },
        { type: 'file', file: { filename: 'offer.pdf', file_data: 'data:application/pdf;base64,JVBERi0xLjcK' } },
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

    await openAiCompatible(BASE_URL, KEY, SOL, true).send(
      request({
        ...WITH_TOOLS,
        turns: [
          { role: 'user', parts: [{ kind: 'text', text: 'Which rate applies?' }] },
          { role: 'assistant', calls: [], raw: assistant },
          {
            role: 'tool-results',
            results: [
              { callId: 'call_Qm3x', text: 'PDV is 25 percent.', isError: false },
              { callId: 'call_Zt8k', text: 'There is no rule pdv-13.', isError: true },
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
})

describe('the Chat Completions reply', () => {
  it('reads stop as the answer, with the tokens from the usage', async () => {
    stubFetch(completion('stop', { content: '{"category":"office"}' }))

    expect(await openAiCompatible(BASE_URL, KEY, SOL, true).send(request())).toEqual({ kind: 'answer', text: '{"category":"office"}', tokens: { input: 812, output: 64 } })
  })

  it('reads stop with a refusal as refused, with the refusal text', async () => {
    stubFetch(completion('stop', { refusal: 'I cannot help with that request.' }))

    expect(await openAiCompatible(BASE_URL, KEY, SOL, true).send(request())).toEqual({ kind: 'refused', reason: 'I cannot help with that request.', tokens: { input: 812, output: 64 } })
  })

  it('reads tool_calls as the calls to run, with their arguments parsed and the message kept to send back', async () => {
    const toolCalls = [functionCall('call_Qm3x', 'rule', '{"id":"pdv-25"}'), functionCall('call_Zt8k', 'rule', '{"id": "pdv-')]
    stubFetch(completion('tool_calls', { tool_calls: toolCalls }))

    const reply = await openAiCompatible(BASE_URL, KEY, SOL, true).send(request(WITH_TOOLS))

    expect(reply).toEqual({
      kind: 'tool-calls',
      calls: [
        { id: 'call_Qm3x', name: 'rule', args: { id: 'pdv-25' } },
        { id: 'call_Zt8k', name: 'rule', args: undefined },
      ],
      raw: { role: 'assistant', content: null, refusal: null, annotations: [], tool_calls: toolCalls },
      tokens: { input: 812, output: 64 },
    })
  })

  it('reads a call to the answer function as the answer, with its arguments as the text', async () => {
    stubFetch(completion('tool_calls', { tool_calls: [functionCall('call_Ans1', 'answer', '{"category":"travel"}')] }))

    expect(await openAiCompatible(BASE_URL, KEY, SOL, true).send(request(WITH_TOOLS))).toEqual({ kind: 'answer', text: '{"category":"travel"}', tokens: { input: 812, output: 64 } })
  })

  it('reads length as an answer cut off and content_filter as refused', async () => {
    stubFetch(completion('length', { content: '{"categ' }), completion('content_filter', { content: null }))
    const model = openAiCompatible(BASE_URL, KEY, SOL, true)

    expect(await model.send(request())).toEqual({ kind: 'cut-off', tokens: { input: 812, output: 64 } })
    expect(await model.send(request())).toEqual({ kind: 'refused', reason: 'content_filter', tokens: { input: 812, output: 64 } })
  })

  it('fails on a finish reason it does not know', async () => {
    stubFetch(completion('function_call', { content: null }))

    await expect(openAiCompatible(BASE_URL, KEY, SOL, true).send(request())).rejects.toMatchObject({ name: 'ModelRequestFailed', status: 200 })
  })

  it('takes whether it reads a PDF from its caller', () => {
    expect(openAiCompatible('https://openrouter.ai/api/v1', KEY, SOL, false).readsPdf).toBe(false)
    expect(openAiCompatible(BASE_URL, KEY, SOL, true).model).toEqual({ name: 'GPT-6.1 Sol', inputPerMillion: 2, outputPerMillion: 10 })
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

    const failure = await openAiCompatible(BASE_URL, KEY, SOL, true)
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
    const model = openAiCompatible(BASE_URL, KEY, SOL, true)

    await expect(model.send(request())).rejects.toMatchObject({ status: 503, message: 'The server is overloaded.' })
    await expect(model.send(request())).rejects.toMatchObject({ status: 502, message: 'Bad Gateway' })
  })

  it('reports a request that never reached the provider with status 0', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('NetworkError when attempting to fetch resource.')))

    await expect(openAiCompatible(BASE_URL, KEY, SOL, true).send(request())).rejects.toMatchObject({
      name: 'ModelRequestFailed',
      status: 0,
      message: 'NetworkError when attempting to fetch resource.',
    })
  })
})

describe('the OpenAI-compatible key test', () => {
  it('lists the models with the bearer key and sends no body', async () => {
    const requests = stubFetch(Response.json({ object: 'list', data: [{ id: 'gpt-6.1-sol', object: 'model', created: 1790000000, owned_by: 'openai' }] }))

    expect(await testOpenAiCompatibleKey(`${BASE_URL}/models`, KEY)).toEqual({ kind: 'works' })
    expect(requests[0]).toMatchObject({ url: 'https://api.openai.com/v1/models', method: 'GET', body: null })
    expect(requests[0]!.headers.authorization).toBe(`Bearer ${KEY}`)
  })

  it('says a key the provider turns away is refused, and anything else failed with the reason', async () => {
    stubFetch(
      Response.json({ error: { message: 'Incorrect API key provided.', type: 'invalid_request_error', param: null, code: 'invalid_api_key' } }, { status: 401 }),
      Response.json({ error: { message: 'You are not allowed to list models.', type: 'invalid_request_error', param: null, code: null } }, { status: 403 }),
      Response.json({ error: { message: 'Rate limit reached for requests.', type: 'requests', param: null, code: 'rate_limit_exceeded' } }, { status: 429 }),
    )

    expect(await testOpenAiCompatibleKey(`${BASE_URL}/models`, KEY)).toEqual({ kind: 'refused' })
    expect(await testOpenAiCompatibleKey(`${BASE_URL}/models`, KEY)).toEqual({ kind: 'refused' })
    expect(await testOpenAiCompatibleKey(`${BASE_URL}/models`, KEY)).toEqual({ kind: 'failed', reason: 'Rate limit reached for requests.' })
  })

  it('says the test failed when the provider cannot be reached', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')))

    expect(await testOpenAiCompatibleKey(`${BASE_URL}/models`, KEY)).toEqual({ kind: 'failed', reason: 'Failed to fetch' })
  })
})

describe('a task run over the OpenAI-compatible adapter', () => {
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

    const result = await runTask(task, 'Which VAT rate applies to office chairs?', { model: openAiCompatible(BASE_URL, KEY, SOL, true), appOn: true, employees: { sends: false, on: false } })

    expect(result).toEqual({
      kind: 'draft',
      draft: { rate: 25, rule: 'pdv-25' },
      problems: [],
      usage: { model: 'GPT-6.1 Sol', inputTokens: 1880, outputTokens: 70, dollars: (1880 * 2 + 70 * 10) / 1_000_000 },
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
    await expect(openAiCompatible(BASE_URL, KEY, SOL, true).send(request())).rejects.toBeInstanceOf(ModelRequestFailed)
  })

  it('keeps the tokens of a finish reason it does not know', async () => {
    stubFetch(completion('function_call', { content: null }))
    const failure = await openAiCompatible(BASE_URL, KEY, SOL, true)
      .send(request())
      .catch((error: unknown) => error)
    expect(failure).toMatchObject({ status: 200, tokens: { input: 812, output: 64 } })
  })
})

describe('the routing of a Chat Completions request', () => {
  it('asks OpenRouter alone to route only to endpoints that honour every parameter', async () => {
    const requests = stubFetch(completion('stop', { content: '{}' }), completion('stop', { content: '{}' }))
    const presets = PROVIDER_PRESETS.filter((preset) => preset.requiresParameters).map((preset) => preset.id)
    expect(presets).toEqual(['openrouter'])
    await openAiCompatible('https://openrouter.ai/api/v1', KEY, SOL, false, true).send(request())
    await openAiCompatible(BASE_URL, KEY, SOL, true).send(request())
    expect(requests[0]!.body!.provider).toEqual({ require_parameters: true })
    expect(requests[1]!.body!.provider).toBeUndefined()
  })

  it('hands fetch the signal', async () => {
    const seen: unknown[] = []
    vi.stubGlobal('fetch', async (_input: string, init: RequestInit) => {
      seen.push(init.signal)
      return completion('stop', { content: '{}' })
    })
    const { signal } = new AbortController()
    await openAiCompatible(BASE_URL, KEY, SOL, true).send(request({ signal }))
    expect(seen).toEqual([signal])
  })
})
