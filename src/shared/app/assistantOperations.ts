import type { StrictSchema } from '../ai/domain/strictSchema'
import type { RecordNoun } from '../storage/domain/recordKind'

/** A change the chat can propose, by name. It is data, and only the app's own write functions act on it. */
export interface AssistantOperation {
  readonly name: string
  readonly about: string
  readonly input: StrictSchema
  /**
   * The input's fields that name a record, each with its kind. A model writes a ref Kuna handed out, or a `$` name of this
   * proposal. A field of the kind `ATTACHMENT_REF` takes the id of a file attached to the chat, and the step gets the file.
   * A field of a list's items is named by the list and the field, such as `parts.category`.
   */
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

/** What an operation's `refs` names a field that takes a file attached to the chat, such as a statement to import. */
export const ATTACHMENT_REF = 'attachment'

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

/** What the card says about its records beside what it writes, such as rows an import leaves waiting. A note is never a change, so the card does not count it. */
export interface ProposalNote {
  readonly label: string
  readonly text: string
  /** `info` for a question waiting on the person, `warning` for something that may be wrong, `neutral` for what the card only reports. */
  readonly tone: 'info' | 'warning' | 'neutral'
  /** Rows the note lists under its text, each as what it is beside what it looks like. */
  readonly items?: readonly ProposalNoteItem[]
}

export interface ProposalNoteItem {
  readonly row: string
  readonly record: string
}

/** The lines of one kind and one verb, with the notes on that kind above them. */
export interface ProposalGroup {
  readonly verb: 'add' | 'change' | 'remove'
  readonly noun: RecordNoun
  readonly notes: readonly ProposalNote[]
  readonly lines: readonly ProposalLine[]
}

/** A note on the card's group of the records named by their noun. */
export interface CardNote {
  readonly noun: RecordNoun
  readonly note: ProposalNote
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
  /** False when Undo could not put the write back, as for a kind that keeps no Undo or a repaired row. The card then says it has no Undo. */
  readonly undoable: boolean
  /** What the card holds back from the write, such as rows that look like records Kuna has, as a sentence for the model with the count and what to ask, or null. It holds counts and row numbers, never what the rows say. */
  readonly heldBack: string | null
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

/** What the person should know of a write that went through, such as series a fetch got nothing for, with the screen that says more, or null. */
export interface DoneWarning {
  readonly text: string
  readonly link: { readonly label: string; readonly to: string } | null
}

/** A done write's `undo` is null when the card has no Undo. */
export type AcceptResult = { readonly kind: 'done'; readonly undo: (() => Promise<UndoResult>) | null; readonly warning?: DoneWarning } | { readonly kind: 'refused'; readonly reason: string }
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
