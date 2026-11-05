/** Sixteen hex digits from two 32-bit FNV-1a passes over the facts joined by `|`, so the same facts read from another export give the same key. */
export function factKey(facts: readonly string[]): string {
  const joined = facts.join('|')
  return `${fnv(joined, 0x811c9dc5)}${fnv(joined, 0x01000193)}`
}

/**
 * Each row's `factKey` with its count among the equal rows before it, in the rows' order, such as
 * `<key>-2` for the second of two equal coffees, so a later export of the same rows gets the same keys.
 */
export function occurrenceKeys(rows: readonly (readonly string[])[]): string[] {
  const occurrences = new Map<string, number>()
  return rows.map((facts) => {
    const key = factKey(facts)
    const occurrence = (occurrences.get(key) ?? 0) + 1
    occurrences.set(key, occurrence)
    return `${key}-${occurrence}`
  })
}

function fnv(text: string, seed: number): string {
  let hash = seed >>> 0
  for (const character of text) {
    hash ^= character.codePointAt(0)!
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}
