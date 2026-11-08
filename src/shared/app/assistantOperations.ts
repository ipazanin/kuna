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
  /** Text fields where an alias stands for every way its person was written, so the step gets the list, such as the words of a rule. */
  readonly spellings?: readonly string[]
  /** Goes one to a card, as a new category does. */
  readonly alone: boolean
  /** A working input, with a ref named after its kind, such as `category`, which a spec runs through the app's checks. */
  readonly example: Readonly<Record<string, unknown>>
}

/** One step of a proposal, with refs turned into ids and aliases into what they stand for, or left as a `$` name of an earlier step. A field listed under `spellings` may hold a list. */
export interface ProposalStep {
  readonly operation: string
  readonly input: Readonly<Record<string, unknown>>
  /** The `$` name a later step may use for what this one creates, or null. */
  readonly as: string | null
}

/** One field a change sets, in Kuna's words. */
export interface ProposalField {
  readonly name: string
  readonly before: string | null
  readonly after: string | null
  /** It says where money or mail goes, so the card marks it. */
  readonly warns: boolean
}

/** One record on the card, by its name on screen, with the fields that say where money or mail goes first. */
export interface ProposalLine {
  readonly label: string
  readonly fields: readonly ProposalField[]
  /** Why the card warns on the record as a whole, such as a row a person confirmed that the change files elsewhere, or null. */
  readonly warning: string | null
}

/** The lines of one kind and one verb. */
export interface ProposalGroup {
  readonly verb: 'add' | 'change' | 'remove'
  readonly noun: RecordNoun
  readonly lines: readonly ProposalLine[]
}

/**
 * A proposal the app's checks passed. `held` is the write as checked, which Accept makes so a record changed since is refused
 * rather than overwritten. When the app keeps a file first, Accept plans it again with that file, and refuses a plan that touches other records.
 */
export interface CheckedProposal {
  readonly title: string
  readonly count: number
  readonly groups: readonly ProposalGroup[]
  /** What Accept does outside the books, which Undo leaves as it is, each a line such as "The PDF stays on Drive after Undo". */
  readonly outside: readonly string[]
  readonly held: object
}

/** What the chat's tools get of an app's changes: a dry run, and no way to write. */
export interface AppProposer {
  readonly operations: readonly AssistantOperation[]
  /** Whether a check reads the app's books, so the person must allow reading the app first. Settings of the device read none. */
  readonly readsBooks: boolean
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
