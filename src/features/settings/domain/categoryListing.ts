import { fold } from '../../../shared/text/fold'
import { typedOwnerShare } from '../../owner-share/domain/ownerShare'
import { BUCKETS } from '../../workbook/domain/bucket'
import { displayName } from '../../workbook/domain/displayName'
import { rolesOfText } from './categoryDrafts'
import type { CategoryDraft } from './categoryDrafts'

/** What narrows the categories table. It lives on the screen only and is never saved to the books. */
export interface CategoryFilters {
  /** Words that must all appear in the category's name, label, family, bucket or roles. */
  readonly search: string
  /** A bucket, or null for every bucket. */
  readonly bucket: string | null
  /** A role, or null for any role or none. */
  readonly role: string | null
  readonly withOwnerShare: boolean
  readonly unsavedOnly: boolean
}

export const NO_FILTERS: CategoryFilters = { search: '', bucket: null, role: null, withOwnerShare: false, unsavedOnly: false }

export type CategorySortColumn = 'category' | 'label' | 'family' | 'bucket' | 'roles' | 'vat' | 'ownerShare'

/** A sort of the categories table by one column. No sort keeps the tab's own order. */
export interface CategorySort {
  readonly column: CategorySortColumn
  readonly descending: boolean
}

/** One draft of the editor, with whether it differs from what the tab holds and whether it has an error. */
export interface ListedDraft {
  readonly draft: CategoryDraft
  readonly unsaved: boolean
  readonly inError: boolean
}

export function filtersInUse(filters: CategoryFilters): boolean {
  return fold(filters.search) !== '' || filters.bucket !== null || filters.role !== null || filters.withOwnerShare || filters.unsavedOnly
}

export function matchesFilters({ draft, unsaved }: ListedDraft, filters: CategoryFilters): boolean {
  const words = fold(filters.search).split(' ').filter((word) => word !== '')
  const slug = draft.category.trim().toLowerCase()
  const searched = fold([slug, draft.label, displayName(slug, draft.label), draft.family, draft.bucket, draft.roles].join(' '))
  return (
    words.every((word) => searched.includes(word)) &&
    (filters.bucket === null || draft.bucket.trim().toLowerCase() === filters.bucket) &&
    (filters.role === null || rolesOfText(draft.roles).includes(filters.role)) &&
    (!filters.withOwnerShare || draft.ownerShare.trim() !== '') &&
    (!filters.unsavedOnly || unsaved)
  )
}

/**
 * The positions of the drafts the table shows, in the order it shows them. A draft with an unsaved
 * change or an error shows whatever the filters say, so nothing Save would write or refuse is out
 * of view. A row added in the editor stays at the foot in the order it was added, where Save puts
 * it. The others follow the sort, a blank value last either way and a tie in the tab's order.
 */
export function categoryListing(drafts: readonly ListedDraft[], filters: CategoryFilters, sort: CategorySort | null): number[] {
  const shown = drafts.flatMap((listed, position) => (listed.unsaved || listed.inError || matchesFilters(listed, filters) ? [position] : []))
  const added = shown.filter((position) => drafts[position]!.draft.saved === null)
  const saved = shown.filter((position) => drafts[position]!.draft.saved !== null)
  if (sort !== null) {
    const direction = sort.descending ? -1 : 1
    const values = new Map(saved.map((position) => [position, sortValue(drafts[position]!.draft, sort.column)]))
    saved.sort((left, right) => compareValues(values.get(left)!, values.get(right)!, direction) || left - right)
  }
  return [...saved, ...added]
}

type SortValue = string | number | null

/** What a column sorts by. Buckets sort in the order of the profit and loss, and an owner share as a number. */
function sortValue(draft: CategoryDraft, column: CategorySortColumn): SortValue {
  const slug = draft.category.trim().toLowerCase()
  switch (column) {
    case 'category':
      return blankAsNull(slug)
    case 'label':
      return blankAsNull(displayName(slug, draft.label))
    case 'family':
      return blankAsNull(draft.family.trim().toLowerCase())
    case 'bucket': {
      const bucket = draft.bucket.trim().toLowerCase()
      const place = (BUCKETS as readonly string[]).indexOf(bucket)
      return bucket === '' ? null : place === -1 ? BUCKETS.length : place
    }
    case 'roles':
      return blankAsNull(rolesOfText(draft.roles).join(', '))
    case 'vat':
      return blankAsNull(draft.vat.trim().toLowerCase())
    case 'ownerShare':
      return typedOwnerShare(draft.ownerShare) ?? null
  }
}

function blankAsNull(text: string): string | null {
  return text === '' ? null : text
}

/** A blank value sorts last in either direction. */
function compareValues(left: SortValue, right: SortValue, direction: number): number {
  if (left === null || right === null) {
    return left === right ? 0 : left === null ? 1 : -1
  }
  return direction * (typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right)))
}
