import { ownerShareProblem, ownerShareText, storedOwnerShare } from '../../../owner-share/domain/ownerShare'
import { withIdField } from '../../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../../shared/storage/domain/recordCodec'
import { amountText, filledFields } from '../../../../../shared/storage/domain/recordFields'
import type { RecordId } from '../../../../../shared/storage/domain/recordId'
import { SHARED_ID_REASON, idSharing, problemOf, refusedProblems } from '../../../../../shared/storage/domain/recordsRead'
import type { Reading, RecordProblem, RecordsRead } from '../../../../../shared/storage/domain/recordsRead'
import { ownId, refuse, slugOf, textOf } from '../../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../../shared/storage/domain/storedFields'
import { ADVANCE_BUCKETS } from '../../../workbook/domain/workbook'
import type { OwnerAdvance } from '../../../workbook/domain/workbook'
import { OWNER_ADVANCE_RECORDS } from './hrDooKinds'
import { words } from './words'

/** A cost the owner paid as the owner-advances tab holds it, before its category is looked up. */
export type OwnerAdvanceEntry = Omit<OwnerAdvance, 'family' | 'bucket'>

/**
 * A negative amount, the owner's private share of a company payment, belongs on the splits tab, so
 * it is refused.
 */
export function ownerAdvanceOf(fields: StoredFields, id: RecordId | null): OwnerAdvanceEntry {
  const date = fields.date === undefined ? refuse(words.reading.noDate) : (fields.date.date ?? refuse(words.reading.notADateCell(fields.date.text)))
  const amount = fields.amount === undefined ? refuse(words.reading.noAmount) : (fields.amount.money ?? refuse(words.reading.notANumber(fields.amount.text)))
  if (amount === 0) {
    refuse(words.reading.zero)
  }
  if (amount < 0) {
    refuse(words.reading.negativeAdvance)
  }
  const category = slugOf(fields.category)
  if (category === '') {
    refuse(words.reading.noCategory)
  }
  return { date, amount, description: textOf(fields.description), category, ownerShare: storedOwnerShare(fields.owner_share), id: ownId(id) }
}

export const OWNER_ADVANCE_CODEC: RecordCodec<OwnerAdvanceEntry> = withIdField(OWNER_ADVANCE_RECORDS, words.labels.ownerAdvance, ownerAdvanceOf, (advance) =>
  filledFields({
    date: advance.date,
    amount: amountText(advance.amount),
    description: advance.description,
    category: advance.category,
    owner_share: ownerShareText(advance.ownerShare),
  }),
)

/** A cost the owner paid counts as a cost, so a category outside the operating and taxes buckets leaves it out. An owner share it cannot read is reported and counts as none. */
export function readOwnerAdvances(
  read: RecordsRead<OwnerAdvanceEntry>,
  categories: readonly { readonly slug: string; readonly family: string; readonly bucket: OwnerAdvance['bucket'] }[],
): Reading<OwnerAdvance> {
  const categoryBySlug = new Map(categories.map((category) => [category.slug, category]))
  const sharesId = idSharing(read)
  const advances: OwnerAdvance[] = []
  const problems: RecordProblem[] = refusedProblems(read)
  for (const stored of read.records) {
    const share = ownerShareProblem(stored.fields.owner_share)
    if (share !== null) {
      problems.push(problemOf(stored, share))
    }
    const { category: slug } = stored.record
    const category = categoryBySlug.get(slug)
    if (category === undefined) {
      problems.push(problemOf(stored, words.reading.notOnCategories(slug)))
    } else if (!(ADVANCE_BUCKETS as readonly string[]).includes(category.bucket)) {
      problems.push(problemOf(stored, words.reading.advanceBucket(slug, category.bucket)))
    } else if (sharesId(stored)) {
      problems.push(problemOf(stored, SHARED_ID_REASON))
    } else {
      advances.push({ ...stored.record, family: category.family, bucket: category.bucket })
    }
  }
  return { facts: advances, problems }
}
