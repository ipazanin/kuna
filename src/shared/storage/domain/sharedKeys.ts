/**
 * The keys more than one record holds. Where a row sits decides nothing, so a reader refuses every
 * record of such a key rather than keep the first.
 */
export function sharedKeys<Fact>(records: readonly Fact[], keyOf: (record: Fact) => string): ReadonlySet<string> {
  const seen = new Set<string>()
  const shared = new Set<string>()
  for (const record of records) {
    const key = keyOf(record)
    if (seen.has(key)) {
      shared.add(key)
    }
    seen.add(key)
  }
  return shared
}
