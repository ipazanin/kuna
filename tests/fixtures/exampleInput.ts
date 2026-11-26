import { ATTACHMENT_REF } from '../../src/shared/app/assistantOperations'
import type { AssistantOperation } from '../../src/shared/app/assistantOperations'

/** A spec's chat, which hands out the ref of a record it read. */
interface RefsHandedOut {
  ref(kind: string, id: string): string
}

/**
 * The operation's example as a step the chat checks: each record it names, in a list's items too, as the ref the chat handed out
 * for the id the spec's books give that name, and a file it names as the id of the file attached to the chat.
 */
export function exampleInput(operation: AssistantOperation, chat: RefsHandedOut, ids: Readonly<Record<string, string>>, attached: string | null = null): Record<string, unknown> {
  const refOf = (kind: string | undefined, named: unknown): unknown => {
    if (kind === undefined || typeof named !== 'string') return named
    if (kind === ATTACHMENT_REF) {
      if (attached === null) throw new Error(`The example of ${operation.name} names a file, and the spec attaches none.`)
      return attached
    }
    const id = ids[named]
    if (id === undefined) throw new Error(`The example of ${operation.name} names ${named}, which the spec's books do not hold.`)
    return chat.ref(kind, id)
  }
  const placed = (path: string, value: unknown): unknown => {
    if (Array.isArray(value)) return value.map((listed: unknown) => placed(path, listed))
    if (typeof value === 'object' && value !== null) return Object.fromEntries(Object.entries(value).map(([name, held]) => [name, placed(`${path}.${name}`, held)]))
    return refOf(operation.refs[path], value)
  }
  return Object.fromEntries(Object.entries(operation.example).map(([field, value]) => [field, placed(field, value)]))
}
