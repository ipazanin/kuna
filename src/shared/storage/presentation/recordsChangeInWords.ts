import type { WriteReceipt } from '../application/recordWrites'
import type { ChangedRecords } from './words'
import { words } from './words'

const VERBS = { add: 'add', change: 'change', repair: 'change', remove: 'remove', discard: 'remove' } as const

/** "Added the invoice "1-1-26"", "Changed 2 categories and deleted an asset", or for an undo "Undid adding the invoice "1-1-26"". */
export function recordsChangeInWords(receipt: WriteReceipt, undid: WriteReceipt | null): string {
  const described = undid ?? receipt
  const groups = new Map<string, { readonly verb: ChangedRecords['verb']; readonly noun: ChangedRecords['noun']; readonly labels: string[] }>()
  for (const { change, label } of described.records) {
    const verb = VERBS[change.verb]
    const key = `${verb} ${change.kind.name}`
    const group = groups.get(key) ?? { verb, noun: change.kind.noun, labels: [] }
    group.labels.push(label)
    groups.set(key, group)
  }
  return words.changes([...groups.values()], undid !== null)
}
