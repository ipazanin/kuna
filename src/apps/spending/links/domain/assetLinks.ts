import { filedAsBought, sameRecord } from './linkTarget'
import type { AssetTarget, LinkTarget } from './linkTarget'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import { rowItemsOf } from '../../workbook/domain/rowItems'
import type { ItemizedRow } from '../../workbook/domain/rowItems'
import type { RowLink } from '../../workbook/domain/rowLink'
import { payeeCondition, sameCondition } from '../../workbook/domain/spendingRule'
import type { SpendingRuleCondition } from '../../workbook/domain/spendingRule'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/**
 * The entry linked to an asset as a cost of it or income from it: the parts the target names carry the link, all of them when it
 * names none, and a chosen part with no category goes under the category the target names, so a waiting entry leaves To review
 * filed. An entry that gains a category is filed by you.
 */
export function assetLinkedEntry(entry: ItemizedRow, target: AssetTarget): ItemizedRow {
  const chosen = (id: RecordId): boolean => target.parts === undefined || target.parts.includes(id)
  const items = entry.items.map((item) => (chosen(item.id) ? { ...item, link: target.link, category: item.category ?? target.category ?? null } : item))
  const filed = items.some((item, place) => item.category !== entry.items[place]?.category)
  return { row: filed ? { ...entry.row, categorisedBy: 'person' } : entry.row, items }
}

/**
 * The category of the newest part linked to the asset as a cost of it, or as income from it, which a waiting entry linked the
 * same way starts with: money out not under Bought assets for a cost, and money in for income. Null when no part is linked so.
 */
export function lastAssetCategory(book: Pick<SpendingBook, 'transactions' | 'items' | 'categories'>, asset: RowLink, use: 'cost' | 'income'): RecordId | null {
  const itemsOf = rowItemsOf(book)
  const newestFirst = [...book.transactions].sort((earlier, later) => later.date.localeCompare(earlier.date))
  for (const row of newestFirst) {
    const part = itemsOf(row).find(
      (item) => item.link !== null && item.category !== null && sameRecord(item.link, asset) && (use === 'cost') === item.amount < 0 && !filedAsBought([item], book.categories),
    )
    if (part?.category != null) return part.category
  }
  return null
}

/** A rule Kuna offers on the Rules card: rows to the payee of an asset's two newest linked rows are linked to it, under the category the newer went under. */
export interface AssetRuleOffer {
  readonly asset: AssetTarget
  readonly condition: SpendingRuleCondition
  readonly category: RecordId
}

/**
 * One rule per asset whose two newest rows linked to it with a category go to the same payee, which no rule tests yet and no
 * rule names the asset, so a one-off repair is not offered. The rule files under the newer row's category and links each row whole.
 */
export function assetRuleOffers(book: Pick<SpendingBook, 'transactions' | 'items' | 'categories' | 'rules'>, targets: readonly LinkTarget[]): readonly AssetRuleOffer[] {
  const itemsOf = rowItemsOf(book)
  const newestFirst = [...book.transactions].sort((earlier, later) => later.date.localeCompare(earlier.date))
  return targets.flatMap((target): AssetRuleOffer[] => {
    if (target.kind !== 'asset' || book.rules.some((rule) => rule.link !== null && sameRecord(rule.link, target.link))) return []
    const linked = newestFirst.flatMap((row) => {
      const part = itemsOf(row).find((item) => item.link !== null && item.category !== null && sameRecord(item.link, target.link))
      const condition = payeeCondition(row)
      return part?.category == null || condition === null ? [] : [{ condition, category: part.category }]
    })
    const [newer, older] = linked
    if (newer === undefined || older === undefined || !sameCondition(newer.condition, older.condition)) return []
    if (book.rules.some((rule) => rule.conditions.some((condition) => sameCondition(condition, newer.condition)))) return []
    return [{ asset: target, condition: newer.condition, category: newer.category }]
  })
}
