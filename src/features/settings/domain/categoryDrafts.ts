import { OWNER_SHARE_ROLES, typedOwnerShare } from '../../owner-share/domain/ownerShare'
import { BUCKETS } from '../../workbook/domain/bucket'
import { categoryOfFields } from '../../workbook/domain/categoriesReading'
import { swatchOf } from '../../workbook/domain/categoryColour'
import type { CategoryRecord } from '../../workbook/domain/categoriesReading'
import { slugProblem } from '../../workbook/domain/slug'
import { slugOf, storedFieldOfValue, textOf } from '../../workbook/domain/storedFields'
import type { StoredField, StoredFields } from '../../workbook/domain/storedFields'
import { isVatTreatment } from '../../workbook/domain/vatTreatment'
import type { StoredRecord } from '../../workbook/domain/recordsRead'
import { madeOfDrafts } from './recordDrafts'
import type { MadeDraft } from './recordDrafts'

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
  /** The default share a row filed in the category takes. Blank means none. */
  readonly ownerShare: string
}

/** The drafts of the stored categories, as the workbook holds their text. */
export function categoryDraftsOf(stored: readonly StoredRecord<unknown>[]): CategoryDraft[] {
  return stored.map(({ fields }, saved) => {
    const text = (name: string): string => textOf(fields[name])
    return {
      saved,
      savedName: text('category'),
      category: text('category'),
      label: text('label'),
      family: text('family'),
      bucket: slugOf(fields.bucket),
      colour: text('colour'),
      roles: text('roles'),
      vat: slugOf(fields.vat),
      ownerShare: text('owner_share'),
    }
  })
}

/** The colour a draft takes from the picker. Bucket colour on a row stored with a colour outside the palette keeps that colour, since it draws in the bucket's colour too. */
export function pickedColour(draft: CategoryDraft, picked: string, stored: readonly StoredRecord<unknown>[]): string {
  const storedColour = draft.saved === null ? '' : textOf(stored[draft.saved]?.fields.colour)
  return picked.trim() === '' && swatchOf(storedColour) === null ? storedColour : picked
}

/** The categories the drafts make, each over the fields its stored record holds. */
export function categoriesOfDrafts(stored: readonly StoredRecord<unknown>[], drafts: readonly CategoryDraft[]): MadeDraft<CategoryRecord>[] {
  const fields = drafts.map((draft) => categoryFieldsOf(draft, draft.saved === null ? {} : (stored[draft.saved]?.fields ?? {})))
  return madeOfDrafts(drafts, fields, stored, categoryOfFields)
}

export type CategoryField = 'category' | 'family' | 'bucket' | 'roles' | 'vat' | 'ownerShare'

export type CategoryDraftErrors = ReadonlyMap<number, Partial<Record<CategoryField, string>>>

/**
 * The rules of the categories tab: every row names a category once, and fills category,
 * family and a bucket from the six. A new name keeps to the slug format. A category in use keeps
 * its name, or the rows that name it would lose their category. Each role and a VAT treatment, if
 * given, is one the app knows. While `shares` shows the owner share, a default is a whole number
 * from 0 to 100, on an operating category, while a category carries the owner-benefit role. Errors
 * are keyed by the draft's position.
 */
export function categoryDraftErrors(drafts: readonly CategoryDraft[], usedNames: ReadonlySet<string>, knownRoles: readonly string[], shares: boolean): CategoryDraftErrors {
  const errors = new Map<number, Partial<Record<CategoryField, string>>>()
  const named = new Set<string>()
  const benefitCategory = drafts.some((draft) => rolesOfText(draft.roles).includes(OWNER_SHARE_ROLES.ownerBenefit))
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
    const unknownRoles = rolesOfText(draft.roles).filter((role) => !knownRoles.includes(role))
    if (unknownRoles.length > 0) {
      found.roles = `Not ${unknownRoles.length === 1 ? 'a role' : 'roles'} the app knows: ${unknownRoles.join(', ')}`
    }
    const vat = draft.vat.trim().toLowerCase()
    if (vat !== '' && !isVatTreatment(vat)) {
      found.vat = 'Not a VAT treatment the app knows'
    }
    const share = typedOwnerShare(draft.ownerShare)
    if (shares && share === undefined) {
      found.ownerShare = 'A whole number from 0 to 100'
    } else if (shares && share !== null && draft.bucket.trim().toLowerCase() !== 'operating') {
      found.ownerShare = 'Only an operating category holds a share'
    } else if (shares && share !== null && !benefitCategory) {
      found.ownerShare = `Give a category the ${OWNER_SHARE_ROLES.ownerBenefit} role first`
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

/** The draft's fields, over the fields of the category it was read from. A blank field is absent. */
function categoryFieldsOf(draft: CategoryDraft, stored: StoredFields): StoredFields {
  const typed: Readonly<Record<string, string>> = {
    category: draft.category.trim().toLowerCase(),
    label: draft.label.trim(),
    family: draft.family.trim().toLowerCase(),
    bucket: draft.bucket.trim().toLowerCase(),
    colour: draft.colour.trim(),
    roles: rolesOfText(draft.roles).join(', '),
    vat: draft.vat.trim().toLowerCase(),
    owner_share: draft.ownerShare.trim(),
  }
  const fields: Record<string, StoredField> = { ...stored }
  for (const [name, text] of Object.entries(typed)) {
    if (text === '') {
      delete fields[name]
    } else {
      fields[name] = storedFieldOfValue(text)
    }
  }
  return fields
}

/** The roles a draft's comma-separated text names, in lower case. */
export function rolesOfText(text: string): string[] {
  return text
    .split(',')
    .map((role) => role.trim().toLowerCase())
    .filter((role) => role !== '')
}
