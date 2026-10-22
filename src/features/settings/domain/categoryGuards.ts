import { slugChangeRefusals } from '../../workbook/domain/slug'
import type { SlugUses } from '../../workbook/domain/slug'
import { ADVANCE_BUCKETS } from '../../workbook/domain/workbook'

interface CategoryCells {
  readonly slug: string
  readonly bucket: string
}

/** One categories row before and after a change. `before` is null for an added row, `after` for a deleted one. */
export interface CategoryEdit {
  readonly before: CategoryCells | null
  readonly after: CategoryCells | null
}

export interface CategoryUses {
  /** What names each category outside its tab: ledger rows, rules, owner advances, split parts, year-end konto rows and plan rows. */
  readonly named: SlugUses
  /** How many owner advances each category carries. */
  readonly advances: ReadonlyMap<string, number>
}

/**
 * A category in use keeps its name and its row, since the ledger's chips, the rules the Apps Script
 * runs every morning and the other tabs name it. A new name keeps to the slug format and is on one
 * row only. A category owner advances carry stays in the operating or taxes bucket, where an advance
 * counts.
 */
export function categoryChangeRefusals(
  edits: readonly CategoryEdit[],
  untouched: readonly { readonly slug: string }[],
  uses: CategoryUses,
): string[] {
  const refusals = slugChangeRefusals(
    'category',
    { edits: edits.map((edit) => ({ from: edit.before?.slug ?? null, to: edit.after?.slug ?? null })), untouched },
    uses.named,
    true,
  )
  for (const edit of edits) {
    if (edit.before === null || edit.after === null || edit.before.slug !== edit.after.slug || edit.before.bucket === edit.after.bucket) {
      continue
    }
    const advances = uses.advances.get(edit.after.slug) ?? 0
    if (advances > 0 && !(ADVANCE_BUCKETS as readonly string[]).includes(edit.after.bucket)) {
      refusals.push(
        `"${edit.after.slug}" stays in the operating or taxes bucket, since ${advances === 1 ? 'an owner advance carries it' : `${advances} owner advances carry it`} and an advance counts only as an operating cost or a tax.`,
      )
    }
  }
  return refusals
}
