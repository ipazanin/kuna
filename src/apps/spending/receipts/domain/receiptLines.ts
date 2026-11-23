import { partCategoryRefusal } from '../../entries/domain/entrySplit'
import type { PartCategoryRefusal } from '../../entries/domain/entrySplit'
import type { Category } from '../../workbook/domain/category'
import type { SharedCost } from '../../workbook/domain/sharedCost'
import type { TransactionItem } from '../../workbook/domain/transactionItem'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** A receipt's line filed anew under a category, with your words on it and who it counts under. Its amount stays the receipt's. */
export interface LineRefile {
  readonly line: RecordId
  readonly category: RecordId
  readonly note: string
  /** Who the line counts under, blank for the entry's payee. */
  readonly payee: string
  /** The shared cost the line joins, its category then In a shared cost. Null takes it out. Left out, it stays in its shared cost until its category changes. */
  readonly sharedCost?: RecordId | null
}

/** Why a receipt line cannot take a filing: it is linked to a record in another app and would join a shared cost, or its category is not one a part may go under. */
export type LineFilingRefusal = 'linked-member' | PartCategoryRefusal

/** Why a line cannot be filed anew: it is not one of the entry's receipt lines, or it cannot take its filing. */
export type LineRefileRefusal = 'not-a-receipt-line' | LineFilingRefusal

/**
 * The entry's items with each receipt line you named under its new category, words and payee, trimmed, and every other item
 * as it was. A line takes a category as a part of a split does, so never a group with children or Between my accounts, and a
 * line linked to a record in another app joins no shared cost.
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
  if (items.some((item) => item.link !== null && refiled.has(item.id) && keptSharedCost(refiled.get(item.id)!, item) !== null)) return { refused: 'linked-member' }
  return items.map((item) => {
    const refile = refiled.get(item.id)
    if (refile === undefined) return item
    return { ...item, category: refile.category, sharedCost: keptSharedCost(refile, item), note: refile.note.trim(), payee: refile.payee.trim() }
  })
}

/** The shared cost a refiled line is in: the one the refile names, or with none named the one it was in while its category stays. */
function keptSharedCost(refile: LineRefile, item: TransactionItem): RecordId | null {
  if (refile.sharedCost !== undefined) return refile.sharedCost
  return refile.category === item.category ? item.sharedCost : null
}

/** A receipt line's category, or the shared cost it is in, and words as the entry dialog holds them while you change them. */
export interface LineFiling {
  /** A category's id, or a shared cost's while the line is in one. */
  readonly category: string
  readonly note: string
}

/** The shared costs a line may be in, and the category In a shared cost a line in one takes. */
export interface LineJoining {
  readonly sharedCosts: readonly Pick<SharedCost, 'id'>[]
  readonly filedIn: RecordId
}

/** What a line's filing names: a category, a shared cost it is in under In a shared cost, or neither. */
function filedAs(filing: LineFiling, categories: readonly Category[], joining: LineJoining | null): { readonly filed: Category | undefined; readonly sharedCost: RecordId | null } {
  const sharedCost = joining?.sharedCosts.find((candidate) => candidate.id === filing.category)
  const category = sharedCost === undefined ? filing.category : joining!.filedIn
  return { filed: categories.find((candidate) => candidate.id === category), sharedCost: sharedCost?.id ?? null }
}

/** The filing a line opens with: the shared cost it is in, or else its category. */
export function lineFilingOf(item: Pick<TransactionItem, 'category' | 'sharedCost' | 'note'>): LineFiling {
  return { category: item.sharedCost ?? item.category ?? '', note: item.note }
}

/**
 * The entry's items as the dialog shows them, each receipt line under the category or in the shared cost picked with its words,
 * then the lines you changed as refiles and why each changed line cannot take its filing. A line left as the file holds it is
 * neither, so a line under a category that no longer takes parts refuses only once you change it.
 */
export function lineRefilesOf(
  categories: readonly Category[],
  items: readonly TransactionItem[],
  filings: Readonly<Record<string, LineFiling>>,
  joining: LineJoining | null = null,
): { readonly lines: readonly TransactionItem[]; readonly refiles: readonly LineRefile[]; readonly refused: ReadonlyMap<RecordId, LineFilingRefusal> } {
  const changed = items.flatMap((item) => {
    const filing = filings[item.id]
    if (filing === undefined || (filing.category === lineFilingOf(item).category && filing.note.trim() === item.note)) return []
    const { filed, sharedCost } = filedAs(filing, categories, joining)
    const refusal: LineFilingRefusal | null = sharedCost !== null && item.link !== null ? 'linked-member' : partCategoryRefusal(filed, categories)
    return [{ line: item.id, filed, sharedCost, note: filing.note, payee: item.payee, refusal }]
  })
  return {
    lines: items.map((item) => {
      const filing = filings[item.id]
      if (filing === undefined) return item
      const { filed, sharedCost } = filedAs(filing, categories, joining)
      return { ...item, category: filed?.id ?? null, sharedCost, note: filing.note }
    }),
    refiles: changed.flatMap(({ line, filed, sharedCost, note, payee, refusal }) => (filed === undefined || refusal !== null ? [] : [{ line, category: filed.id, sharedCost, note, payee }])),
    refused: new Map(changed.flatMap(({ line, refusal }) => (refusal === null ? [] : [[line, refusal] as const]))),
  }
}
