import type { Category } from './category'
import { eventPutIn } from './event'
import { flagOf } from './fieldReading'
import { requiredReference } from './recordReference'
import type { SharedCost } from './sharedCost'
import { CATEGORY_RECORDS, LABEL_RECORDS, SHARED_COST_RECORDS } from './spendingKinds'
import type { TransactionItem } from './transactionItem'
import { eventChoiceOf, eventChoiceText } from './transactionItemReading'
import { memberProblem } from '../../sharedCosts/domain/sharedCostMembers'
import type { MemberProblem } from '../../sharedCosts/domain/sharedCostMembers'
import { labelWords, withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { filledFields } from '../../../../shared/storage/domain/recordFields'
import { keyOfRecordId } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { doubted, readEach } from '../../../../shared/storage/domain/recordsRead'
import type { Reading, RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import { idsOf, idsText, ownId, requiredDate, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'

export function sharedCostOf(fields: StoredFields, id: RecordId | null): SharedCost {
  return {
    id: ownId(id),
    day: requiredDate(fields, 'day'),
    payee: textOf(fields.payee).trim(),
    category: requiredReference(fields, 'category', CATEGORY_RECORDS),
    labels: idsOf(fields.labels, LABEL_RECORDS),
    event: eventChoiceOf(fields),
    note: textOf(fields.note).trim(),
    settled: flagOf(fields, 'settled'),
  }
}

export const SHARED_COST_CODEC: RecordCodec<SharedCost> = withIdField(
  SHARED_COST_RECORDS,
  (fields) => labelWords([textOf(fields.payee), textOf(fields.day)]),
  sharedCostOf,
  (sharedCost) =>
    filledFields({
      day: sharedCost.day,
      payee: sharedCost.payee,
      category: keyOfRecordId(CATEGORY_RECORDS, sharedCost.category),
      labels: sharedCost.labels.length === 0 ? null : idsText(sharedCost.labels, LABEL_RECORDS),
      event: eventChoiceText(sharedCost.event),
      note: sharedCost.note,
      settled: sharedCost.settled ? true : null,
    }),
)

/** Why a shared cost is doubted: its category is not in the file or not a spending or income one, or it names a label or an event the file lacks. */
export type SharedCostProblem = 'no-category' | 'not-spending-or-income' | 'unknown-label' | 'unknown-event'

/** The shared costs, each counting, doubted for the first problem it has, so its money is never dropped from the file's problems unseen. */
export function readSharedCosts(
  read: RecordsRead<SharedCost>,
  book: { readonly categories: readonly Category[]; readonly labels: readonly { readonly id: RecordId }[]; readonly events: readonly { readonly id: RecordId }[] },
  reasons: { readonly [Problem in SharedCostProblem]: string },
): Reading<SharedCost> {
  const categories = new Map(book.categories.map((category) => [category.id, category]))
  const labels = new Set(book.labels.map((label) => label.id))
  const events = new Set(book.events.map((event) => event.id))
  const problemOf = (sharedCost: SharedCost): SharedCostProblem | null => {
    const category = categories.get(sharedCost.category)
    if (category === undefined) return 'no-category'
    if (category.kind !== 'spending' && category.kind !== 'income') return 'not-spending-or-income'
    if (sharedCost.labels.some((label) => !labels.has(label))) return 'unknown-label'
    const event = eventPutIn(sharedCost.event)
    return event === null || events.has(event) ? null : 'unknown-event'
  }
  return doubted(
    readEach(read, () => []),
    read,
    (sharedCost) => {
      const problem = problemOf(sharedCost)
      return problem === null ? null : reasons[problem]
    },
  )
}

/** The items, each one that breaks the rule of a member doubted for it, so a write that would break it is refused. */
export function withMembers(
  reading: Reading<TransactionItem>,
  read: RecordsRead<TransactionItem>,
  book: { readonly sharedCosts: readonly SharedCost[]; readonly categories: readonly Category[] },
  reasons: { readonly [Problem in MemberProblem]: string },
): Reading<TransactionItem> {
  return doubted(reading, read, (item) => {
    const problem = memberProblem(item, book)
    return problem === null ? null : reasons[problem]
  })
}
