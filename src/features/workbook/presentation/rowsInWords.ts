import type { WriteReceipt } from '../application/recordWrites'
import type { RecordNoun } from '../domain/recordKind'

function counted(noun: RecordNoun, count: number): string {
  return count === 1 ? `${noun.article} ${noun.one}` : `${count} ${noun.many}`
}

const RECORD_VERBS = {
  add: { done: 'added', undone: 'adding' },
  change: { done: 'changed', undone: 'changing' },
  repair: { done: 'changed', undone: 'changing' },
  remove: { done: 'deleted', undone: 'deleting' },
  discard: { done: 'deleted', undone: 'deleting' },
} as const

/** "Added the invoice "1-1-26"", "Changed 2 categories and deleted an asset", or for an undo "Undid adding the invoice "1-1-26"". */
export function recordsChangeInWords(receipt: WriteReceipt, undid: WriteReceipt | null): string {
  const described = undid ?? receipt
  const groups = new Map<string, { readonly verb: (typeof RECORD_VERBS)[keyof typeof RECORD_VERBS]; readonly noun: RecordNoun; readonly labels: string[] }>()
  for (const { change, label } of described.records) {
    const key = `${RECORD_VERBS[change.verb].done} ${change.kind.name}`
    const group = groups.get(key) ?? { verb: RECORD_VERBS[change.verb], noun: change.kind.noun, labels: [] }
    group.labels.push(label)
    groups.set(key, group)
  }
  const parts = [...groups.values()].map(({ verb, noun, labels }) => `${undid === null ? verb.done : verb.undone} ${labels.length === 1 ? `the ${noun.one} "${labels[0]}"` : counted(noun, labels.length)}`)
  const sentence = parts.length <= 1 ? (parts[0] ?? 'changed nothing') : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`
  const said = undid === null ? sentence : `undid ${sentence}`
  return `${said.charAt(0).toUpperCase()}${said.slice(1)}`
}
