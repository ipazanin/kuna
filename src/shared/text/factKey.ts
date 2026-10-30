/** Sixteen hex digits from two 32-bit FNV-1a passes over the facts joined by `|`, so the same facts read from another export give the same key. */
export function factKey(facts: readonly string[]): string {
  const joined = facts.join('|')
  return `${fnv(joined, 0x811c9dc5)}${fnv(joined, 0x01000193)}`
}

function fnv(text: string, seed: number): string {
  let hash = seed >>> 0
  for (const character of text) {
    hash ^= character.codePointAt(0)!
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}
