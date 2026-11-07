/** What one or more requests spent. Each input token counts in exactly one of the three input parts, as each is billed at its own rate. */
export interface ModelTokens {
  /** Input read fresh, at the full rate. */
  readonly input: number
  readonly cacheRead: number
  readonly cacheWrite: number
  readonly output: number
  /** What the provider says it charged, where it says so. A sum holds it only if every request reported one. */
  readonly chargedDollars?: number
}

/** A model's list price in US dollars per million tokens. */
export interface ModelPrice {
  readonly inputPerMillion: number
  readonly cacheReadPerMillion: number
  readonly cacheWritePerMillion: number
  readonly outputPerMillion: number
  /** The dearer rates of a request whose prompt runs over a size, cached tokens counted, which a provider prices whole. */
  readonly longPrompt?: { readonly overTokens: number; readonly inputTimes: number; readonly outputTimes: number }
}

/** What one run used, and what the provider said it charged or else its cost at list price. `dollars` is null when Kuna knows neither. */
export interface AiUsage {
  /** The model's name, such as Sonnet 5.5. */
  readonly model: string
  readonly inputTokens: number
  readonly cacheReadTokens: number
  readonly cacheWriteTokens: number
  readonly outputTokens: number
  readonly dollars: number | null
}

export const NO_TOKENS: ModelTokens = { input: 0, cacheRead: 0, cacheWrite: 0, output: 0, chargedDollars: 0 }

/** The ratios to the input price that the provider presets' prices hold, or fall just under for cache reads. They need no price, so they also weigh a typed model. */
const CACHE_READ_WEIGHT = 0.1
const CACHE_WRITE_WEIGHT = 1.25
const OUTPUT_WEIGHT = 5

export function addedTokens(left: ModelTokens, right: ModelTokens): ModelTokens {
  return {
    input: left.input + right.input,
    cacheRead: left.cacheRead + right.cacheRead,
    cacheWrite: left.cacheWrite + right.cacheWrite,
    output: left.output + right.output,
    ...(left.chargedDollars === undefined || right.chargedDollars === undefined ? {} : { chargedDollars: left.chargedDollars + right.chargedDollars }),
  }
}

/** Whether these tokens show no spending at all, as with a reply that reports no usage. */
export function spentNothing(tokens: ModelTokens): boolean {
  return promptTokens(tokens) + tokens.output + (tokens.chargedDollars ?? 0) === 0
}

/** What these tokens weigh as tokens of fresh input, each kind at the weight its price gives it. */
export function fullRateTokens(tokens: ModelTokens): number {
  return tokens.input + tokens.cacheRead * CACHE_READ_WEIGHT + tokens.cacheWrite * CACHE_WRITE_WEIGHT + tokens.output * OUTPUT_WEIGHT
}

/** The size of the prompt these tokens came from, which a provider's limits and price steps count whole. */
export function promptTokens(tokens: ModelTokens): number {
  return tokens.input + tokens.cacheRead + tokens.cacheWrite
}

/** What one request cost at list price. A price step goes by each request's own prompt, so requests are priced apart and then added. */
export function costOfRequest(tokens: ModelTokens, price: ModelPrice): number {
  const step = price.longPrompt
  const long = step !== undefined && promptTokens(tokens) > step.overTokens
  const inputTimes = long ? step.inputTimes : 1
  const outputTimes = long ? step.outputTimes : 1
  return (
    ((tokens.input * price.inputPerMillion + tokens.cacheRead * price.cacheReadPerMillion + tokens.cacheWrite * price.cacheWritePerMillion) * inputTimes +
      tokens.output * price.outputPerMillion * outputTimes) /
    1_000_000
  )
}

/** What a run used. `listDollars` adds up each request's own cost. */
export function usageOf(model: { readonly name: string; readonly price: ModelPrice | null }, tokens: ModelTokens, listDollars: number): AiUsage {
  return {
    model: model.name,
    inputTokens: tokens.input,
    cacheReadTokens: tokens.cacheRead,
    cacheWriteTokens: tokens.cacheWrite,
    outputTokens: tokens.output,
    dollars: tokens.chargedDollars ?? (model.price === null ? null : listDollars),
  }
}
