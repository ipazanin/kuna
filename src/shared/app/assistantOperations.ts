import type { StrictSchema } from '../ai/domain/strictSchema'
import type { RecordNoun } from '../storage/domain/recordKind'

/** A change the chat can propose, by name. It is data, and only the app's own write functions act on it. */
export interface AssistantOperation {
  readonly name: string
  readonly about: string
  readonly input: StrictSchema
  /** The input's fields that name a record, each with its kind. A model writes a ref Kuna handed out, or a `$` name of this proposal. */
  readonly refs: Readonly<Record<string, string>>
  /** What it creates that a later step may name by `$`, or null. */
  readonly creates: string | null
  /** Goes one to a card, as a new category does. */
  readonly alone: boolean
  /** A working input, with a ref named after its kind, such as `category`, which a spec runs through the app's checks. */
  readonly example: Readonly<Record<string, unknown>>
}

/** One step of a proposal, with refs turned into ids and aliases into what they stand for, or left as a `$` name of an earlier step. */
export interface ProposalStep {
  readonly operation: string
  readonly input: Readonly<Record<string, unknown>>
  /** The `$` name a later step may use for what this one creates, or null. */
  readonly as: string | null
}

/** One record on the card, in Kuna's words. */
export interface ProposalLine {
  readonly label: string
  readonly fields: readonly { readonly name: string; readonly before: string | null; readonly after: string | null }[]
  /** It says where money or mail goes, so the card marks it. */
  readonly warns: boolean
}

/** The lines of one kind and one verb. */
export interface ProposalGroup {
  readonly verb: 'add' | 'change' | 'remove'
  readonly noun: RecordNoun
  readonly lines: readonly ProposalLine[]
}

/** A proposal the app's checks passed. `held` is what Accept writes, unchanged, so a record changed since is refused rather than overwritten. */
export interface CheckedProposal {
  readonly title: string
  readonly count: number
  readonly groups: readonly ProposalGroup[]
  readonly held: object
}

/** What the chat's tools get of an app's changes: a dry run, and no way to write. */
export interface AppProposer {
  readonly operations: readonly AssistantOperation[]
  /** Checks the steps against the file as it stands, writing nothing. Gives why not, each a sentence, when they would not go. */
  check(title: string, steps: readonly ProposalStep[]): Promise<CheckedProposal | { readonly refused: readonly string[] }>
}

export type AcceptResult = { readonly kind: 'done'; undo(): Promise<UndoResult> } | { readonly kind: 'refused'; readonly reason: string }
export type UndoResult = { readonly kind: 'undone' } | { readonly kind: 'refused'; readonly reason: string }

/** What only the proposal card reaches: one write of one proposal, by a person's click. */
export interface AppAcceptance {
  accept(proposal: CheckedProposal): Promise<AcceptResult>
}

/** Something a person can start with one tap in an empty chat. Only a person starts it. */
export interface AssistantQuickAction {
  readonly label: string
  readonly prompt: string
}
