import type { WriteReceipt } from '../application/recordWrites'
import type { ChangedRecords } from './words'
import { words } from './words'

const VERBS = { add: 'add', change: 'change', repair: 'change', remove: 'remove', discard: 'remove' } as const

/** The id a record of a kind holds in the field, or null. */
function idIn(record: unknown, field: string): unknown {
  return typeof record === 'object' && record !== null ? ((record as Readonly<Record<string, unknown>>)[field] ?? null) : null
}

/**
 * "Added the invoice "1-1-26"", "Changed 2 categories and deleted an asset", or for an undo "Undid adding the invoice "1-1-26"".
 * A part of a whole, such as an entry's item, counts as a change of its whole, once per whole and not at all when the write
 * names the whole itself. A part of no whole counts as itself.
 */
export function recordsChangeInWords(receipt: WriteReceipt, undid: WriteReceipt | null): string {
  const described = undid ?? receipt
  const recordOf = (change: WriteReceipt['records'][number]['change']): unknown => ('after' in change ? change.after : 'before' in change ? change.before : null)
  const wholes = new Set(described.records.map(({ change }) => `${change.kind.name} ${String(idIn(recordOf(change), 'id'))}`))
  const groups = new Map<string, { readonly verb: ChangedRecords['verb']; readonly noun: ChangedRecords['noun']; readonly labels: string[] }>()
  const counted = new Set<string>()
  const add = (key: string, verb: ChangedRecords['verb'], noun: ChangedRecords['noun'], label: string): void => {
    const group = groups.get(key) ?? { verb, noun, labels: [] }
    group.labels.push(label)
    groups.set(key, group)
  }
  for (const { change, label } of described.records) {
    const { partOf } = change.kind
    const whole = partOf === undefined ? null : idIn(recordOf(change), partOf.field)
    if (partOf === undefined || whole === null) {
      add(`${VERBS[change.verb]} ${change.kind.name}`, VERBS[change.verb], change.kind.noun, label)
      continue
    }
    const wholeKey = `${partOf.kind} ${String(whole)}`
    if (wholes.has(wholeKey) || counted.has(wholeKey)) continue
    counted.add(wholeKey)
    add(`change ${partOf.kind}`, 'change', partOf.noun, label)
  }
  return words.changes([...groups.values()], undid !== null)
}
