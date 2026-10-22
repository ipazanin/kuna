import { BUCKETS } from '../../workbook/domain/bucket'
import { slugProblem } from '../../workbook/domain/slug'
import { isVatTreatment } from '../../workbook/domain/vatTreatment'

/** One row of the categories editor, as text, the way the tab holds it. */
export interface CategoryDraft {
  /** Where the row this draft was read from stands among the rows the editor opened with, or null for a row added in the editor. */
  readonly saved: number | null
  /** The name the row had when the editor opened, which ledger rows may use. */
  readonly savedName: string
  readonly category: string
  /** What the screens call it. Blank shows the category itself. */
  readonly label: string
  readonly family: string
  readonly bucket: string
  readonly colour: string
  readonly roles: string
  /** Blank means none. */
  readonly vat: string
}

export type CategoryField = 'category' | 'family' | 'bucket' | 'vat'

export type CategoryDraftErrors = ReadonlyMap<number, Partial<Record<CategoryField, string>>>

/**
 * The rules of the Sheet's categories tab: every row names a category once, and fills category,
 * family and a bucket from the six. A new name keeps to the slug format. A category in use keeps
 * its name, or the rows that name it would lose their category. A VAT treatment, if given, is one
 * the app knows. Errors are keyed by the draft's position.
 */
export function categoryDraftErrors(drafts: readonly CategoryDraft[], usedNames: ReadonlySet<string>): CategoryDraftErrors {
  const errors = new Map<number, Partial<Record<CategoryField, string>>>()
  const named = new Set<string>()
  drafts.forEach((draft, index) => {
    const found: Partial<Record<CategoryField, string>> = {}
    const name = draft.category.trim().toLowerCase()
    if (name === '') {
      found.category = 'Required'
    } else if (named.has(name)) {
      found.category = 'Already used above'
    } else if (renamesUsed(draft, drafts, usedNames)) {
      found.category = `${draft.savedName} is in use, so it keeps its name`
    } else if (name !== draft.savedName.trim().toLowerCase() && slugProblem(name, 'category') !== null) {
      found.category = 'Lower-case letters, digits and single hyphens'
    }
    if (name !== '') {
      named.add(name)
    }
    if (draft.family.trim() === '') {
      found.family = 'Required'
    }
    if (!(BUCKETS as readonly string[]).includes(draft.bucket.trim().toLowerCase())) {
      found.bucket = draft.bucket.trim() === '' ? 'Required' : 'Not one of the six buckets'
    }
    const vat = draft.vat.trim().toLowerCase()
    if (vat !== '' && !isVatTreatment(vat)) {
      found.vat = 'Not a VAT treatment the app knows'
    }
    if (Object.keys(found).length > 0) {
      errors.set(index, found)
    }
  })
  return errors
}

/**
 * Whether renaming this row would leave ledger rows without their category. Of rows that share a
 * used name only the first in the editor keeps it, so a duplicate can still be renamed away.
 */
export function keepsItsName(draft: CategoryDraft, drafts: readonly CategoryDraft[], usedNames: ReadonlySet<string>): boolean {
  const saved = draft.savedName.trim().toLowerCase()
  return saved !== '' && usedNames.has(saved) && drafts.find((candidate) => candidate.savedName.trim().toLowerCase() === saved) === draft
}

function renamesUsed(draft: CategoryDraft, drafts: readonly CategoryDraft[], usedNames: ReadonlySet<string>): boolean {
  return keepsItsName(draft, drafts, usedNames) && draft.category.trim().toLowerCase() !== draft.savedName.trim().toLowerCase()
}

/** The tab's cells for the drafts. Cells of other columns on a saved row are kept. */
export function categoryCellsOf(
  drafts: readonly CategoryDraft[],
  savedCells: ReadonlyMap<number, Readonly<Record<string, string | number | boolean>>>,
): Record<string, string | number | boolean>[] {
  return drafts.map((draft) => ({
    ...(draft.saved === null ? {} : (savedCells.get(draft.saved) ?? {})),
    category: draft.category.trim().toLowerCase(),
    label: draft.label.trim(),
    family: draft.family.trim().toLowerCase(),
    bucket: draft.bucket.trim().toLowerCase(),
    colour: draft.colour.trim(),
    roles: draft.roles
      .split(',')
      .map((role) => role.trim().toLowerCase())
      .filter((role) => role !== '')
      .join(', '),
    vat: draft.vat.trim().toLowerCase(),
  }))
}
