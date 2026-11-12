import type { AssistantOperation } from '../../src/shared/app/assistantOperations'
import { operationInput } from '../../src/shared/app/assistantOperations'

/** A step for a desk to propose, its input built from the operation's example with `changes` set, so a field the operation gains reaches every spec through its example. */
export function stepOf(
  operations: readonly AssistantOperation[],
  op: string,
  changes: Readonly<Record<string, unknown>> = {},
  as?: string,
): { readonly op: string; readonly input: Readonly<Record<string, unknown>>; readonly as?: string } {
  const input = operationInput(operations, op, changes)
  return as === undefined ? { op, input } : { op, input, as }
}
