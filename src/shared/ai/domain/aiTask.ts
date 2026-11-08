import type { AiUsage } from './modelUsage'
import type { StrictSchema } from './strictSchema'
import type { Money } from '../../money/money'

export interface AiTextPart {
  readonly kind: 'text'
  readonly text: string
}

/** A PDF as it is sent. `name` reaches the provider, so it is the attachment's id, such as `a2`, and never the file's own name. */
export interface AiPdfPart {
  readonly kind: 'pdf'
  readonly base64: string
  readonly name: string
}

/** A photo as it is sent, with the size it is sent at, which the request's token count reads. */
export interface AiImagePart {
  readonly kind: 'image'
  readonly base64: string
  readonly mediaType: 'image/jpeg'
  readonly width: number
  readonly height: number
}

/** One part of what a task sends: text Kuna built, which is masked, or a whole document or photo, which cannot be. */
export type AiPart = AiTextPart | AiPdfPart | AiImagePart

/** What a tool hands back: text for the model, and the sources and figures an answer may then cite. */
export interface ToolAnswer {
  readonly text: string
  readonly sources: readonly string[]
  readonly figures: readonly { readonly ref: string; readonly cents: Money }[]
}

/** A read-only lookup over an app's own functions, which the model may call while it works on a task. */
export interface AiTool {
  readonly name: string
  readonly description: string
  readonly input: StrictSchema
  /** Throws a RangeError to tell the model the arguments name nothing, such as a year the ruleset does not reach. */
  run(args: unknown): Promise<ToolAnswer>
}

/** What the tools answered in one run, which a task's check holds an answer against. */
export interface ToolLog {
  readonly answers: readonly ToolAnswer[]
}

/** A task's own check of an answer that matches its schema: the draft it makes of it, and what it dropped or doubts. */
export interface Checked<Output> {
  readonly draft: Output
  readonly problems: readonly string[]
}

/** One job an app gives the model, built from its own data, with the schema of what comes back and the app's own check. */
export interface AiTask<Input, Output> {
  /** The app's id, a dot, and the task's name, such as `company.suggest-categories`. */
  readonly id: `${string}.${string}`
  /** The app whose switch lets the task run. */
  readonly app: string
  readonly effort: 'low' | 'medium' | 'high'
  /** Text that stays the same from run to run, sent first so it can be cached. */
  system(): readonly AiTextPart[]
  input(input: Input): readonly AiPart[]
  /** The schema of the answer, whose enums may hold what this input names, such as its rows' refs. */
  output(input: Input): StrictSchema
  readonly tools: readonly AiTool[]
  /** Called only with an answer that matches the schema. */
  check(output: unknown, input: Input, log: ToolLog): Checked<Output>
}

/**
 * How a run ended: a draft with the problems the checks found, a reply that gave no draft, or no request at all.
 * `holds-secret` is a request the egress guard kept from leaving. `switched-off` names the switch that is off: the
 * app's, or the one a task needs for employee data.
 */
export type TaskResult<Output> =
  | { readonly kind: 'draft'; readonly draft: Output; readonly problems: readonly string[]; readonly usage: AiUsage | null }
  | { readonly kind: 'refused' | 'cut-off' | 'too-long' | 'over-budget' | 'failed' | 'holds-secret'; readonly reason: string; readonly usage: AiUsage | null }
  | { readonly kind: 'switched-off'; readonly which: 'app' | 'employees' }
  | { readonly kind: 'no-key' | 'no-pdf' }
