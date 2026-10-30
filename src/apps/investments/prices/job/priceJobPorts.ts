import type { FailureReason } from '../domain/pricesFile'

/** What a provider answered: its HTTP status and the body as text. */
export interface ProviderAnswer {
  readonly status: number
  readonly text: string
}

/** What the job needs from Apps Script. `Triggers.js` is the only code that fills these in. */
export interface PriceJobPorts {
  /** Throws when no answer comes at all. */
  fetch(url: string, headers: Readonly<Record<string, string>>): ProviderAnswer
  readFile(fileId: string): string
  /** Overwrites the file's content. */
  writeFile(fileId: string, text: string): void
  /** A script property, or null when it is not set. */
  property(name: string): string | null
  pause(milliseconds: number): void
}

/** When the job runs: an ISO timestamp and the day in Europe/Zagreb. */
export interface JobClock {
  readonly at: string
  readonly day: string
}

export type Fetched<Answer> = Answer | { readonly kind: 'failed'; readonly reason: FailureReason }

/** The body of a request that came back fine, or why not. */
export function fetchedText(ports: PriceJobPorts, url: string, headers: Readonly<Record<string, string>> = {}): Fetched<{ readonly kind: 'text'; readonly text: string }> {
  let answer: ProviderAnswer
  try {
    answer = ports.fetch(url, headers)
  } catch {
    return { kind: 'failed', reason: 'no-answer' }
  }
  if (answer.status === 200) {
    return { kind: 'text', text: answer.text }
  }
  return { kind: 'failed', reason: answer.status === 404 ? 'unknown-symbol' : answer.status === 429 ? 'limit' : 'refused' }
}

/** The JSON a body holds, or undefined for a body that is not JSON. */
export function parsedJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}
