import { ownerShareProblem, ownerShareText, storedOwnerShare } from '../../owner-share/domain/ownerShare'
import { isDefinedBucket } from './bucket'
import { categoryColourOf } from './categoryColour'
import { filledKey, labelWords } from './recordCodec'
import type { RecordCodec } from './recordCodec'
import { filledFields } from './recordFields'
import { recordIdOf } from './recordId'
import type { RecordId } from './recordId'
import { CATEGORY_RECORDS } from './recordKind'
import { problemOf, refusedProblems } from './recordsRead'
import type { Reading, RecordsRead } from './recordsRead'
import { sharedKeys } from './sharedKeys'
import { keyedId, refuse, slugListOf, slugOf, textOf } from './storedFields'
import type { StoredFields } from './storedFields'
import { isVatTreatment } from './vatTreatment'
import type { Category, RecordProblem } from './workbook'

/** A category as the categories tab holds it, with the id its name makes. */
export type CategoryRecord = Category & { readonly id: RecordId }

/**
 * A category is matched case-insensitively. A record is a definition only when category, family and
 * bucket are all filled, and the bucket is one the analysis knows. A VAT treatment the app does not
 * know reads as none, a colour outside the palette as the bucket's, and an owner share that is not a
 * whole number from 0 to 100 as none, so the category still counts.
 */
export function categoryOf(fields: StoredFields, id: RecordId | null): CategoryRecord {
  const slug = slugOf(fields.category)
  const family = slugOf(fields.family)
  const bucket = slugOf(fields.bucket)
  if (slug === '' || family === '' || bucket === '') {
    refuse('category, family and bucket are not all filled')
  }
  if (!isDefinedBucket(bucket)) {
    refuse(`"${bucket}" is not a bucket`)
  }
  const vat = slugOf(fields.vat)
  return {
    slug,
    label: textOf(fields.label),
    family,
    bucket,
    colour: categoryColourOf(textOf(fields.colour)),
    roles: slugListOf(fields.roles),
    vat: isVatTreatment(vat) ? vat : 'none',
    ownerShare: storedOwnerShare(fields.owner_share),
    id: keyedId(id),
  }
}

export const CATEGORY_CODEC: RecordCodec<CategoryRecord> = {
  kind: CATEGORY_RECORDS,
  key: (fields) => filledKey(slugOf(fields.category)),
  label: (fields) => labelWords([textOf(fields.category)]),
  make: categoryOf,
  fieldsOf: (category) =>
    filledFields({
      category: category.slug,
      family: category.family,
      bucket: category.bucket,
      colour: category.colour.stored,
      roles: category.roles.join(', '),
      label: category.label,
      vat: category.vat === 'none' ? null : category.vat,
      owner_share: ownerShareText(category.ownerShare),
    }),
}

/** A category made from its fields, with the id its name makes, as an editor makes one. */
export function categoryOfFields(fields: StoredFields): CategoryRecord {
  return categoryOf(fields, recordIdOf(CATEGORY_RECORDS, slugOf(fields.category)))
}

/**
 * The categories the workbook defines. A category two records define is defined by neither, since
 * where a row sits decides nothing, and its ledger rows read unclassified. A VAT treatment the app
 * does not know is reported, and so is an owner share it cannot read.
 */
export function readCategories(read: RecordsRead<CategoryRecord>): Reading<CategoryRecord> {
  const problems: RecordProblem[] = refusedProblems(read)
  for (const stored of read.records) {
    const vat = slugOf(stored.fields.vat)
    if (vat !== '' && !isVatTreatment(vat)) {
      problems.push(problemOf(stored, `vat "${vat}" is not a VAT treatment, so ${stored.record.slug} reads as none`))
    }
    const share = ownerShareProblem(stored.fields.owner_share)
    if (share !== null) {
      problems.push(problemOf(stored, share))
    }
  }
  const shared = sharedKeys(read.records, (stored) => stored.record.slug)
  for (const stored of read.records.filter((candidate) => shared.has(candidate.record.slug))) {
    problems.push(problemOf(stored, `"${stored.record.slug}" is defined on more than one row, so none of them counts`))
  }
  return { facts: read.records.map((stored) => stored.record).filter((category) => !shared.has(category.slug)), problems }
}

/** The categories the workbook defines, as the rest of the app knows them, by name. */
export function definedCategories(read: RecordsRead<CategoryRecord>): Category[] {
  return withoutIds(readCategories(read).facts)
}

export function definedCategorySlugs(read: RecordsRead<CategoryRecord>): ReadonlySet<string> {
  return new Set(readCategories(read).facts.map((category) => category.slug))
}

/** Records without their id, for a record the rest of the app knows by its name. */
export function withoutIds<Fact extends { readonly id: RecordId }>(facts: readonly Fact[]): Omit<Fact, 'id'>[] {
  return facts.map(({ id: _id, ...fact }) => fact)
}
