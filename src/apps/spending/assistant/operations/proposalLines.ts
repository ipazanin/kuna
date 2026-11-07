import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import { words } from '../words'
import type { ProposalGroup, ProposalLine } from '../../../../shared/app/assistantOperations'
import { plainAmount } from '../../../../shared/money/money'
import type { CheckedWrite } from '../../../../shared/storage/application/recordWrites'
import type { RecordNoun } from '../../../../shared/storage/domain/recordKind'

/** Fields a person has no use for on a card, which Kuna keeps by itself. */
const LEFT_OFF: ReadonlySet<string> = new Set(['id', 'order', 'colour', 'categorisedBy', 'source', 'importKey', 'statement', 'movedAt', 'pocket', 'pair', 'closed', 'hidden', 'description'])

/** The fields that say where money or mail goes, which the owner lets a model fill with a warning on the line. */
const WARNS: ReadonlySet<string> = new Set(['iban', 'counterpartyIban', 'value'])

function fieldName(field: string): string {
  return (words.proposals.fields as Readonly<Record<string, string>>)[field] ?? field
}

/** A value as a person reads it: a name for a record it points at, an amount for cents, and the words of a rule's condition. */
function shownValue(field: string, value: unknown, record: Readonly<Record<string, unknown>>, book: SpendingBook, namesOf: ReadonlyMap<unknown, string>): string | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'boolean') return value ? words.proposals.yes : words.proposals.no
  if (field === 'condition') {
    const condition = value as { readonly fragment?: string; readonly iban?: string }
    return condition.fragment ?? condition.iban ?? null
  }
  if (typeof value === 'number' && (field === 'amount' || field === 'opening' || field === 'total')) {
    const account = book.accounts.find((candidate) => candidate.id === record['account'] || candidate.id === record['id'])
    return `${plainAmount(value)} ${account?.currency ?? 'EUR'}`
  }
  return namesOf.get(value) ?? String(value)
}

function lineOf(
  label: string,
  before: Readonly<Record<string, unknown>> | null,
  after: Readonly<Record<string, unknown>> | null,
  book: SpendingBook,
  namesOf: ReadonlyMap<unknown, string>,
): ProposalLine {
  const names = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])].filter((field) => !LEFT_OFF.has(field))
  const altered = before !== null && after !== null ? names.filter((field) => JSON.stringify(before[field]) !== JSON.stringify(after[field])) : after !== null ? names : []
  const fields = altered.flatMap((field) => {
    const was = before === null ? null : shownValue(field, before[field], before, book, namesOf)
    const will = after === null ? null : shownValue(field, after[field], after, book, namesOf)
    return was === null && will === null ? [] : [{ name: fieldName(field), before: was, after: will }]
  })
  const condition = (after?.['condition'] ?? null) as { readonly iban?: string } | null
  return { label, fields, warns: altered.some((field) => WARNS.has(field)) || condition?.iban !== undefined }
}

/** What a checked write does, grouped by verb and kind in the order it does it, in Kuna's words and never the model's. */
export function proposalGroupsOf(checked: CheckedWrite, book: SpendingBook): readonly ProposalGroup[] {
  const namesOf = new Map<unknown, string>([...book.categories, ...book.accounts].map((record) => [record.id, record.name]))
  checked.changes.forEach(({ change }) => {
    if (change.verb === 'add' && 'name' in (change.after as object) && 'id' in (change.after as object)) namesOf.set((change.after as { id: string }).id, (change.after as { name: string }).name)
  })
  const groups = new Map<string, { verb: ProposalGroup['verb']; noun: RecordNoun; lines: ProposalLine[] }>()
  checked.changes.forEach(({ change }, at) => {
    if (change.verb === 'repair' || change.verb === 'discard') return
    const key = `${change.verb}/${change.kind.name}`
    const group = groups.get(key) ?? { verb: change.verb, noun: change.kind.noun, lines: [] }
    groups.set(key, group)
    const label = checked.written[at]?.label ?? checked.found[at]?.label ?? ''
    const before = change.verb === 'add' ? null : (change.before as Readonly<Record<string, unknown>>)
    const after = change.verb === 'remove' ? null : (change.after as Readonly<Record<string, unknown>>)
    group.lines.push(lineOf(label, before, after, book, namesOf))
  })
  return [...groups.values()]
}
