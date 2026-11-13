/** A part a write leaves that took money from other parts, with the parts it replaces. */
export interface PartReplacement<Id> {
  readonly part: Id
  readonly replaces: readonly Id[]
}

/**
 * What each part a write leaves replaces of the parts it found. A new part, or one that grew, took its money from every part the
 * write removed or made smaller, so it replaces each of them. A part that kept its id and did not grow replaces nothing. Amounts
 * compare by size, so a part of the other sign counts as it does in the whole.
 */
export function partReplacements<Id, Cents extends number>(
  before: readonly { readonly id: Id; readonly amount: Cents }[],
  after: readonly { readonly id: Id; readonly amount: Cents }[],
): readonly PartReplacement<Id>[] {
  const left = new Map(after.map((part) => [part.id, Math.abs(part.amount)]))
  const found = new Map(before.map((part) => [part.id, Math.abs(part.amount)]))
  const replaced = before.filter((part) => (left.get(part.id) ?? 0) < Math.abs(part.amount)).map((part) => part.id)
  if (replaced.length === 0) return []
  return after.filter((part) => Math.abs(part.amount) > (found.get(part.id) ?? 0)).map((part) => ({ part: part.id, replaces: replaced }))
}
