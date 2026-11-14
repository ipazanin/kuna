import { ownerShareProblem, ownerShareText, storedOwnerShare } from '../../../owner-share/domain/ownerShare'
import { withIdField } from '../../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../../shared/storage/domain/recordCodec'
import { plainAmount } from '../../../../../shared/money/money'
import { amountText, filledFields } from '../../../../../shared/storage/domain/recordFields'
import { keyOfRecordId, recordIdOf } from '../../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../../shared/storage/domain/recordId'
import { ITEM_RECORDS } from '../../../workbook/domain/coreKinds'
import { SHARED_ID_REASON, idSharing, problemOf, recordWithId, refusedProblems } from '../../../../../shared/storage/domain/recordsRead'
import type { Reading, RecordProblem, RecordsRead } from '../../../../../shared/storage/domain/recordsRead'
import { ownId, refuse, slugOf, textOf } from '../../../../../shared/storage/domain/storedFields'
import type { StoredField, StoredFields } from '../../../../../shared/storage/domain/storedFields'
import { ADVANCE_BUCKETS } from '../../../workbook/domain/workbook'
import type { OwnerAdvance, Workbook } from '../../../workbook/domain/workbook'
import { advanceItemProblems } from './advanceRepayments'
import type { AdvanceItemProblem } from './advanceRepayments'
import { OWNER_ADVANCE_RECORDS } from './hrDooKinds'
import { words } from './words'

/** A cost the owner paid as the owner-advances tab holds it, before its category is looked up. */
export type OwnerAdvanceEntry = Omit<OwnerAdvance, 'family' | 'bucket'> & {
  /** The items of the payments to the owner that paid it back. Left out while none did. */
  readonly repaidBy?: readonly RecordId[]
}

/**
 * The items that paid each advance back, by the advance's id, in books that keep items. Books from before items have none, since
 * they match their advances to the payments to the owner on every read.
 */
export type RepaidBy = ReadonlyMap<RecordId, readonly RecordId[]>

/** The advances that count, and in books that keep items what paid each back. */
export interface OwnerAdvancesReading extends Reading<OwnerAdvance> {
  readonly repaidBy: RepaidBy | null
}

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
  const repaidBy = itemsOf(fields.items)
  return { date, amount, description: textOf(fields.description), category, ownerShare: storedOwnerShare(fields.owner_share), id: ownId(id), ...(repaidBy.length === 0 ? {} : { repaidBy }) }
}

/** The items a cell names by their keys, separated by `|`. */
function itemsOf(field: StoredField | undefined): RecordId[] {
  return textOf(field)
    .split('|')
    .map((key) => key.trim())
    .filter((key) => key !== '')
    .map((key) => recordIdOf(ITEM_RECORDS, key))
}

export const OWNER_ADVANCE_CODEC: RecordCodec<OwnerAdvanceEntry> = withIdField(OWNER_ADVANCE_RECORDS, words.labels.ownerAdvance, ownerAdvanceOf, (advance) =>
  filledFields({
    date: advance.date,
    amount: amountText(advance.amount),
    description: advance.description,
    category: advance.category,
    owner_share: ownerShareText(advance.ownerShare),
    items: (advance.repaidBy ?? []).map((item) => keyOfRecordId(ITEM_RECORDS, item)).join(' | '),
  }),
)

/**
 * A cost the owner paid counts as a cost, so a category outside the operating and taxes buckets leaves it out. An owner share it
 * cannot read is reported and counts as none. In books that keep items each advance names the items that paid it back, none while
 * it is open, and books from before items name none, since they match each advance to the payments on every read.
 */
export function readOwnerAdvances(
  read: RecordsRead<OwnerAdvanceEntry>,
  categories: readonly { readonly slug: string; readonly family: string; readonly bucket: OwnerAdvance['bucket'] }[],
  itemsStored: boolean,
): OwnerAdvancesReading {
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
      const { repaidBy: _repaidBy, ...advance } = stored.record
      advances.push({ ...advance, family: category.family, bucket: category.bucket })
    }
  }
  const repaidBy = new Map(advances.map((advance) => [advance.id, recordWithId(read, advance.id)?.record.repaidBy ?? []]))
  return { facts: advances, problems, repaidBy: itemsStored ? repaidBy : null }
}

/** The problems of the items the advances name as what paid them back, each on its advance. */
export function advanceItemProblemsOf(read: RecordsRead<OwnerAdvanceEntry>, reading: OwnerAdvancesReading, ledger: Pick<Workbook, 'transactions' | 'splits' | 'categories'>): RecordProblem[] {
  if (reading.repaidBy === null) return []
  return [...advanceItemProblems(reading.facts, reading.repaidBy, ledger)].flatMap(([id, problems]) =>
    problems.map((problem) => problemOf({ id, label: recordWithId(read, id)?.label ?? id }, advanceItemWords(problem))),
  )
}

/** Why one item an advance names does not count as what paid it back. */
export function advanceItemWords(problem: AdvanceItemProblem): string {
  switch (problem.kind) {
    case 'not-a-payment':
      return words.reading.advanceItemNotAPayment(keyOfRecordId(ITEM_RECORDS, problem.item))
    case 'named-before':
      return words.reading.advanceItemNamedBefore(keyOfRecordId(ITEM_RECORDS, problem.item))
    case 'more-than-paid':
      return words.reading.advanceRepaidMore(plainAmount(problem.repaid))
  }
}
