/** A model a provider offers, with its list price in US dollars per million tokens. */
export interface ModelChoice {
  readonly id: string
  /** Its short name, such as Sonnet 5.5. */
  readonly name: string
  readonly inputPerMillion: number
  readonly outputPerMillion: number
}

export type ProviderId = 'anthropic' | 'openai' | 'openrouter'

/** How a Test of a key ended: the provider took it, refused it, or could not be asked. */
export type KeyTest = { readonly kind: 'works' } | { readonly kind: 'refused' } | { readonly kind: 'failed'; readonly reason: string }

export interface ProviderPreset {
  /** Its id, which is also the id of its key in the secrets file. */
  readonly id: ProviderId
  readonly name: string
  readonly adapter: 'anthropic-messages' | 'openai-compatible'
  readonly baseUrl: string
  readonly models: readonly ModelChoice[]
  readonly defaultModel: string
  readonly readsPdf: boolean
  /** Whether it must route a request only to endpoints that honour every parameter, which OpenRouter's strict answers need. */
  readonly requiresParameters: boolean
  /** The address a Test of a key asks, which answers without the key only when the key is refused. Null for the Anthropic adapter's own test. */
  readonly keyTestUrl: string | null
  /** Where a person makes a key. */
  readonly keyAddress: string
}

// No preset lists a model that searches the web, OpenRouter's web variants among them.
export const PROVIDER_PRESETS: readonly ProviderPreset[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    adapter: 'anthropic-messages',
    baseUrl: 'https://api.anthropic.com',
    models: [
      { id: 'claude-haiku-5-5', name: 'Haiku 5.5', inputPerMillion: 0.1, outputPerMillion: 0.5 },
      { id: 'claude-sonnet-5-5', name: 'Sonnet 5.5', inputPerMillion: 2, outputPerMillion: 10 },
      { id: 'claude-opus-5-5', name: 'Opus 5.5', inputPerMillion: 4, outputPerMillion: 20 },
    ],
    defaultModel: 'claude-sonnet-5-5',
    readsPdf: true,
    requiresParameters: false,
    keyTestUrl: null,
    keyAddress: 'https://platform.claude.com/settings/keys',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    adapter: 'openai-compatible',
    baseUrl: 'https://api.openai.com/v1',
    models: [
      { id: 'gpt-6-luna', name: 'GPT-6 Luna', inputPerMillion: 0.1, outputPerMillion: 0.5 },
      { id: 'gpt-6.1-terra', name: 'GPT-6.1 Terra', inputPerMillion: 1, outputPerMillion: 5 },
      { id: 'gpt-6.1-sol', name: 'GPT-6.1 Sol', inputPerMillion: 2, outputPerMillion: 10 },
      { id: 'gpt-6-astra', name: 'GPT-6 Astra', inputPerMillion: 10, outputPerMillion: 50 },
    ],
    defaultModel: 'gpt-6.1-sol',
    readsPdf: true,
    requiresParameters: false,
    keyTestUrl: 'https://api.openai.com/v1/models',
    keyAddress: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    adapter: 'openai-compatible',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: [
      { id: 'anthropic/claude-sonnet-5-5', name: 'Sonnet 5.5', inputPerMillion: 2, outputPerMillion: 10 },
      { id: 'anthropic/claude-haiku-5-5', name: 'Haiku 5.5', inputPerMillion: 0.1, outputPerMillion: 0.5 },
      { id: 'openai/gpt-6.1-sol', name: 'GPT-6.1 Sol', inputPerMillion: 2, outputPerMillion: 10 },
    ],
    defaultModel: 'anthropic/claude-sonnet-5-5',
    readsPdf: false,
    requiresParameters: true,
    // Its list of models answers without a key, so the Test asks about the key itself.
    keyTestUrl: 'https://openrouter.ai/api/v1/key',
    keyAddress: 'https://openrouter.ai/settings/keys',
  },
]

export function presetOf(id: ProviderId): ProviderPreset {
  return PROVIDER_PRESETS.find((preset) => preset.id === id)!
}

/** The model of the preset with this id, or its default when the id is not one it lists. */
export function modelChoice(preset: ProviderPreset, id: string | null): ModelChoice {
  return preset.models.find((model) => model.id === id) ?? preset.models.find((model) => model.id === preset.defaultModel)!
}
