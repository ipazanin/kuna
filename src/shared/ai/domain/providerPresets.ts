import type { ModelPrice } from './modelUsage'

/** A model to run: one a provider's preset lists, or one typed by hand, whose price Kuna does not know. */
export interface ModelChoice {
  readonly id: string
  /** Its short name, such as Sonnet 5.5, and for a typed model its id. */
  readonly name: string
  readonly price: ModelPrice | null
}

function priced(inputPerMillion: number, cacheReadPerMillion: number, cacheWritePerMillion: number, outputPerMillion: number): ModelPrice {
  return { inputPerMillion, cacheReadPerMillion, cacheWritePerMillion, outputPerMillion }
}

export type ProviderId = 'anthropic' | 'openai' | 'openrouter'

/** How a Test of a key ended: the provider took it, refused it, or could not be asked. */
export type KeyTest = { readonly kind: 'works' } | { readonly kind: 'refused' } | { readonly kind: 'failed'; readonly reason: string }

export interface ProviderPreset {
  /** Its id, which is also the id of its key in the secrets file. */
  readonly id: ProviderId
  readonly name: string
  readonly adapter: 'anthropic-messages' | 'openai-responses' | 'openrouter-chat'
  readonly baseUrl: string
  readonly models: readonly ModelChoice[]
  readonly defaultModel: string
  /** The address a Test of a key asks, which answers without the key only when the key is refused. Null for the Anthropic adapter's own test. */
  readonly keyTestUrl: string | null
  /** Where a person makes a key. */
  readonly keyAddress: string
  /** Whether its adapter takes a PDF, so a person setting up documents is not walked to a company that cannot read them. */
  readonly readsPdf: boolean
}

// No preset lists a model that searches the web, OpenRouter's web variants among them.
export const PROVIDER_PRESETS: readonly ProviderPreset[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    adapter: 'anthropic-messages',
    baseUrl: 'https://api.anthropic.com',
    models: [
      { id: 'claude-haiku-5-5', name: 'Haiku 5.5', price: priced(0.1, 0.01, 0.125, 0.5) },
      { id: 'claude-sonnet-5-5', name: 'Sonnet 5.5', price: priced(2, 0.1, 2.5, 10) },
      { id: 'claude-opus-5-5', name: 'Opus 5.5', price: priced(4, 0.2, 5, 20) },
    ],
    defaultModel: 'claude-sonnet-5-5',
    keyTestUrl: null,
    keyAddress: 'https://platform.claude.com/settings/keys',
    readsPdf: true,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    adapter: 'openai-responses',
    baseUrl: 'https://api.openai.com/v1',
    models: [
      { id: 'gpt-6-luna', name: 'GPT-6 Luna', price: priced(0.1, 0.01, 0.125, 0.5) },
      { id: 'gpt-6.1-terra', name: 'GPT-6.1 Terra', price: priced(1, 0.05, 1.25, 5) },
      { id: 'gpt-6.1-sol', name: 'GPT-6.1 Sol', price: priced(2, 0.1, 2.5, 10) },
      { id: 'gpt-6-astra', name: 'GPT-6 Astra', price: priced(10, 1, 12.5, 50) },
    ],
    defaultModel: 'gpt-6.1-sol',
    keyTestUrl: 'https://api.openai.com/v1/models',
    keyAddress: 'https://platform.openai.com/api-keys',
    readsPdf: true,
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    adapter: 'openrouter-chat',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: [
      { id: 'anthropic/claude-sonnet-5-5', name: 'Sonnet 5.5', price: priced(2, 0.1, 2.5, 10) },
      { id: 'anthropic/claude-haiku-5-5', name: 'Haiku 5.5', price: priced(0.1, 0.01, 0.125, 0.5) },
      { id: 'openai/gpt-6.1-sol', name: 'GPT-6.1 Sol', price: priced(2, 0.1, 2.5, 10) },
    ],
    defaultModel: 'anthropic/claude-sonnet-5-5',
    // Its list of models answers without a key, so the Test asks about the key itself.
    keyTestUrl: 'https://openrouter.ai/api/v1/key',
    keyAddress: 'https://openrouter.ai/settings/keys',
    readsPdf: false,
  },
]

export function presetOf(id: ProviderId): ProviderPreset {
  return PROVIDER_PRESETS.find((preset) => preset.id === id)!
}

/** Whether the id itself turns on OpenRouter's web search, which no request field shows and which would get around the owner's switch for the web. */
export function turnsOnWebSearch(modelId: string): boolean {
  return /:online(?::|$)/i.test(modelId.trim())
}

/** The model with this id, whether the preset lists it or it was typed by hand, or the preset's default for no id at all or one that turns on web search. */
export function modelChoice(preset: ProviderPreset, id: string | null): ModelChoice {
  const wanted = id === null || turnsOnWebSearch(id) ? preset.defaultModel : id
  return preset.models.find((model) => model.id === wanted) ?? { id: wanted, name: wanted, price: null }
}
