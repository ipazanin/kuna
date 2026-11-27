/**
 * The category most of the parts' money is under, by size, the first in the parts' order on a tie, or null for no parts. A row whose
 * split or receipt comes off counts whole under it, in both apps.
 */
export function mainCategoryOf<Category>(parts: readonly { readonly amount: number; readonly category: Category }[]): Category | null {
  const sums = new Map<Category, number>()
  for (const part of parts) sums.set(part.category, (sums.get(part.category) ?? 0) + Math.abs(part.amount))
  const main = [...sums].reduce<[Category, number] | null>((largest, entry) => (largest === null || entry[1] > largest[1] ? entry : largest), null)
  return main === null ? null : main[0]
}
