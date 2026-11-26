import { ATTACHMENT_REF, NONE_REF, cardWarnings } from '../../app/assistantOperations'
import type { AppProposer, CheckedProposal, ProposalStep } from '../../app/assistantOperations'
import type { ChatAttachment } from '../domain/chatAttachments'
import { schemaProblems } from '../domain/strictSchema'
import type { Pseudonyms } from '../../privacy/domain/pseudonyms'
import { NOT_ALLOWED, labelLeaving, refusal } from './chatReads'
import type { ChatReads, ChatToolAnswer } from './chatReads'

export interface ProposeInput {
  readonly app: string
  readonly title: string
  readonly steps: readonly { readonly op: string; readonly input: string; readonly as: string | null }[]
  /** Another card of the job follows once the person accepts this one. */
  readonly next: boolean
}

const TEMPORARY_NAME = /^\$[a-z0-9]+$/i
const REFUSED_ABOUT_AN_EMPLOYEE = 'Kuna refused a step for a reason that names an employee, which stays on this device while Anonymise is on. Say so.'

function parsed(input: string): Readonly<Record<string, unknown>> | null {
  try {
    const value: unknown = JSON.parse(input)
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Readonly<Record<string, unknown>>) : null
  } catch {
    return null
  }
}

/** A value with every alias and token Kuna handed out back as what it stands for, inside lists and objects too, such as a statement's rows. */
function restoredIn(value: unknown, pseudonyms: Pseudonyms): unknown {
  if (typeof value === 'string') return pseudonyms.restored(value)
  if (Array.isArray(value)) return value.map((held) => restoredIn(held, pseudonyms))
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([field, held]) => [field, restoredIn(held, pseudonyms)]))
  return value
}

/**
 * Puts the id in place of each ref at `path` of a record, and says whether every ref was one Kuna handed out. A list on the
 * way or at the end is read entry by entry, so `parts.choices.labels` reaches each label of each part. A null stays.
 */
function idsInPlace(record: Record<string, unknown>, path: readonly string[], idOf: (value: unknown) => string | null): boolean {
  const [name, ...inner] = path
  const held = record[name!]
  if (held === null || held === undefined) return true
  if (inner.length === 0) {
    const ids = (Array.isArray(held) ? held : [held]).map(idOf)
    if (ids.some((id) => id === null)) return false
    record[name!] = Array.isArray(held) ? ids : ids[0]
    return true
  }
  const objects: readonly unknown[] = Array.isArray(held) ? held : [held]
  return objects.every((object) => object !== null && typeof object === 'object' && !Array.isArray(object) && idsInPlace(object as Record<string, unknown>, inner, idOf))
}

/** List items with each alias in the named list fields turned into every way the person was written, and the rest restored. */
function spelledItems(items: readonly unknown[], names: readonly string[], pseudonyms: Pseudonyms): unknown[] {
  return items.map((item) => {
    const restored = restoredIn(item, pseudonyms)
    if (item === null || typeof item !== 'object' || restored === null || typeof restored !== 'object') return restored
    const spelled = { ...(restored as Record<string, unknown>) }
    for (const name of names) {
      const held: unknown = (item as Record<string, unknown>)[name]
      if (!Array.isArray(held)) continue
      spelled[name] = held.flatMap((value: unknown): unknown[] => {
        if (typeof value !== 'string') return [value]
        const spellings = pseudonyms.spellingsOf(value)
        return spellings.length > 1 ? [...spellings] : [pseudonyms.restored(value)]
      })
    }
    return spelled
  })
}

/**
 * A step with refs turned into ids, attachment ids into the files, and aliases into what they stand for, so a model writes
 * `Person 3` and the record holds the name. A field the operation lists under `spellings` gets every way the person was
 * written, so a rule covers each, and so does a list field of a list's items named as `list.field`. A field of refs holds one
 * ref or a list of them, and a ref may sit in an object or in a list's items, named by its path such as `list.object.field`.
 * Or why not, in a sentence.
 */
function resolvedStep(app: string, proposer: AppProposer, step: ProposeInput['steps'][number], names: Set<string>, reads: ChatReads, attachments: readonly ChatAttachment[]): ProposalStep | string {
  const operation = proposer.operations.find((candidate) => candidate.name === step.op)
  if (operation === undefined) return `There is no such operation. Take it from ${app}/op.`
  const input = parsed(step.input)
  if (input === null) return `The input of ${operation.name} is not a JSON object.`
  const problems = schemaProblems(input, operation.input)
  if (problems.length > 0) return `${operation.name}: ${problems.join('. ')}. Its page ${app}/op/${operation.name} shows its input and an example that works.`
  /** The id a ref stands for, a `$` name as it is, or null for neither. */
  const idOf = (value: unknown, kind: string): string | null => {
    if (typeof value === 'string' && names.has(value)) return value
    const record = typeof value === 'string' ? reads.refs.recordOf(value) : null
    return record === null || record.app !== app || record.kind !== kind ? null : record.id
  }
  const notARef = (field: string, kind: string) => `${operation.name}: ${field} is not a ref Kuna handed out for a ${kind}, or a $ name of an earlier step.`
  const resolved: Record<string, unknown> = {}
  for (const [field, value] of Object.entries(input)) {
    const kind = operation.refs[field]
    const innerRefs = Object.entries(operation.refs).filter(([name]) => name.startsWith(`${field}.`))
    if (innerRefs.length > 0 && value !== null && typeof value === 'object') {
      const held: Record<string, unknown> = { [field]: restoredIn(value, reads.pseudonyms) }
      for (const [name, of] of innerRefs) {
        if (!idsInPlace(held, name.split('.'), (ref) => idOf(ref, of))) return notARef(name, of)
      }
      resolved[field] = held[field]
    } else if (kind === undefined || value === null) {
      const spellings = typeof value === 'string' && operation.spellings?.includes(field) === true ? reads.pseudonyms.spellingsOf(value) : []
      const itemSpellings = (operation.spellings ?? []).flatMap((name) => (name.startsWith(`${field}.`) ? [name.slice(field.length + 1)] : []))
      resolved[field] = spellings.length > 1 ? spellings : Array.isArray(value) && itemSpellings.length > 0 ? spelledItems(value, itemSpellings, reads.pseudonyms) : restoredIn(value, reads.pseudonyms)
    } else if (value === NONE_REF && operation.noneRefs?.includes(field) === true) {
      resolved[field] = NONE_REF
    } else if (kind === ATTACHMENT_REF) {
      const attachment = attachments.find((held) => held.id === value)
      if (attachment === undefined) return `${operation.name}: ${field} is not the id of a file attached to this chat.`
      resolved[field] = attachment
    } else {
      const held: Record<string, unknown> = { [field]: value }
      if (!idsInPlace(held, [field], (ref) => idOf(ref, kind))) return notARef(field, kind)
      resolved[field] = held[field]
    }
  }
  if (step.as !== null) {
    if (operation.creates === null || !TEMPORARY_NAME.test(step.as)) return `${operation.name}: "as" takes a name starting with $, on a step that makes something.`
    names.add(step.as)
  }
  return { operation: operation.name, input: resolved, as: step.as }
}

/**
 * A dry run of the steps, through the app's own checks. What passes shows as a card, and what the model hears holds nothing
 * the card holds. The title stays as the model wrote it, aliases and all, as it goes back to the model and into the chat
 * kept in this browser. A proposer that reads no books, such as Kuna's own settings, needs no yes to read them.
 */
export async function proposeChanges(
  input: ProposeInput,
  proposers: ReadonlyMap<string, AppProposer>,
  reads: ChatReads,
  attachments: readonly ChatAttachment[],
  showProposal: (app: string, proposal: CheckedProposal, next: boolean) => void,
): Promise<ChatToolAnswer> {
  const proposer = proposers.get(input.app)
  if (proposer === undefined) return refusal('Nothing can be proposed in that app yet. Say what to do and link its screen.')
  if (input.steps.length === 0) return refusal('A proposal needs at least one step.')
  const names = new Set<string>()
  const steps: ProposalStep[] = []
  for (const step of input.steps) {
    const resolved = resolvedStep(input.app, proposer, step, names, reads, attachments)
    if (typeof resolved === 'string') return refusal(resolved)
    steps.push(resolved)
  }
  const alone = steps.filter((step) => proposer.operations.find((operation) => operation.name === step.operation)?.alone === true)
  if (alone.length > 1) return refusal(`${alone[0]!.operation} goes one to a card. Propose the first, and the next once it is answered.`)
  if (proposer.readsBooks && !reads.mayRead()) return refusal(NOT_ALLOWED)
  const checked = await proposer.check(input.title, steps)
  if ('refused' in checked) {
    const sent = checked.refused.map((reason) => labelLeaving(reason, reads) ?? REFUSED_ABOUT_AN_EMPLOYEE).join(' ')
    return { text: sent, isError: true, read: { kind: 'refusal', app: reads.readers.get(input.app)?.name ?? input.app } }
  }
  showProposal(input.app, checked, input.next)
  const shown = `The card shows ${checked.count} changes. Nothing is written until the person accepts.`
  const warned = cardWarnings(checked)
  const told = [
    ...(warned === 0 ? [] : [`The card warns of ${warned === 1 ? '1 thing' : `${warned} things`}. Tell the person to read the warnings before accepting.`]),
    ...(checked.heldBack === null ? [] : [checked.heldBack]),
  ]
  if (told.length === 0) return { text: `${shown} Say so in one short line and stop.`, isError: false }
  return { text: `${shown} ${told.join(' ')} Say so in one or two short lines and stop.`, isError: false }
}
