/**
 * The category most of the parts' money is under, by size, the first in the parts' order on a tie. A row whose split or receipt
 * comes off counts whole under it, in both apps.
 */
export function mainCategoryOf<Category>(parts: readonly { readonly amount: number; readonly category: Category }[]): Category {
  const sums = new Map<Category, number>()
  for (const part of parts) sums.set(part.category, (sums.get(part.category) ?? 0) + Math.abs(part.amount))
  return [...sums].reduce((main, entry) => (entry[1] > main[1] ? entry : main))[0]
}
