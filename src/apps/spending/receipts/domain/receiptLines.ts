import { partCategoryRefusal } from '../../entries/domain/entrySplit'
import type { PartCategoryRefusal } from '../../entries/domain/entrySplit'
import type { Category } from '../../workbook/domain/category'
import type { TransactionItem } from '../../workbook/domain/transactionItem'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** A receipt's line filed anew under a category, with your words on it and who it counts under. Its amount stays the receipt's. */
export interface LineRefile {
  readonly line: RecordId
  readonly category: RecordId
  readonly note: string
  /** Who the line counts under, blank for the entry's payee. */
  readonly payee: string
}

/** Why a line cannot be filed anew: it is not one of the entry's receipt lines, or its category is not one a part may go under. */
export type LineRefileRefusal = 'not-a-receipt-line' | PartCategoryRefusal

/**
 * The entry's items with each receipt line you named under its new category, words and payee, trimmed, and every other item
 * as it was. A line takes a category as a part of a split does, so never a group with children or Between my accounts.
 */
export function refiledReceiptLines(
  categories: readonly Category[],
  items: readonly TransactionItem[],
  refiles: readonly LineRefile[],
): readonly TransactionItem[] | { readonly refused: LineRefileRefusal } {
  const lines = new Set(items.flatMap((item) => (item.receipt === null ? [] : [item.id])))
  if (refiles.some((refile) => !lines.has(refile.line))) return { refused: 'not-a-receipt-line' }
  const byId = new Map(categories.map((category) => [category.id, category]))
  const wrongCategory = refiles.map((refile) => partCategoryRefusal(byId.get(refile.category), categories)).find((refusal) => refusal !== null) ?? null
  if (wrongCategory !== null) return { refused: wrongCategory }
  const refiled = new Map(refiles.map((refile) => [refile.line, refile]))
  return items.map((item) => {
    const refile = refiled.get(item.id)
    return refile === undefined ? item : { ...item, category: refile.category, note: refile.note.trim(), payee: refile.payee.trim() }
  })
}

/** A receipt line's category and words as the entry dialog holds them while you change them. */
export interface LineFiling {
  readonly category: string
  readonly note: string
}

/**
 * The entry's items as the dialog shows them, each receipt line under the category and words picked, then the lines you changed
 * as refiles and why each changed line cannot take its category. A line left as the file holds it is neither, so a line under a
 * category that no longer takes parts refuses only once you change it.
 */
export function lineRefilesOf(
  categories: readonly Category[],
  items: readonly TransactionItem[],
  filings: Readonly<Record<string, LineFiling>>,
): { readonly lines: readonly TransactionItem[]; readonly refiles: readonly LineRefile[]; readonly refused: ReadonlyMap<RecordId, PartCategoryRefusal> } {
  const changed = items.flatMap((item) => {
    const filing = filings[item.id]
    if (filing === undefined || (filing.category === (item.category ?? '') && filing.note.trim() === item.note)) return []
    const filed = categories.find((category) => category.id === filing.category)
    return [{ line: item.id, filed, note: filing.note, payee: item.payee, refusal: partCategoryRefusal(filed, categories) }]
  })
  return {
    lines: items.map((item) => {
      const filing = filings[item.id]
      return filing === undefined ? item : { ...item, category: categories.find((category) => category.id === filing.category)?.id ?? null, note: filing.note }
    }),
    refiles: changed.flatMap(({ line, filed, note, payee, refusal }) => (filed === undefined || refusal !== null ? [] : [{ line, category: filed.id, note, payee }])),
    refused: new Map(changed.flatMap(({ line, refusal }) => (refusal === null ? [] : [[line, refusal] as const]))),
  }
}
