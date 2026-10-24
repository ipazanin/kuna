import type { BillingItem } from './billingPlan'
import { dayText, labelWords, numberText, withIdField } from './recordCodec'
import type { RecordCodec } from './recordCodec'
import { amountText, filledFields } from './recordFields'
import type { RecordId } from './recordId'
import { BILLING_RECORDS } from './recordKind'
import { SHARED_ID_REASON, idSharing, problemOf, refusedProblems } from './recordsRead'
import type { Reading, RecordsRead } from './recordsRead'
import { ownId, positiveMoney, refuse, requiredDate, slugOf, textOf } from './storedFields'
import type { StoredFields } from './storedFields'
import type { RecordProblem } from './workbook'

export function billingItemOf(fields: StoredFields, id: RecordId | null): BillingItem {
  const item = textOf(fields.item)
  if (item === '') refuse('no item')
  const date = fields.date === undefined ? refuse('no date') : requiredDate(fields, 'date')
  const amount = positiveMoney(fields, 'amount')
  const client = slugOf(fields.client)
  if (client === '') refuse('no client')
  return { item, date, amount, client, description: textOf(fields.description), id: ownId(id) }
}

export const BILLING_CODEC: RecordCodec<BillingItem> = withIdField(
  BILLING_RECORDS,
  (fields) => labelWords([textOf(fields.item), textOf(fields.client), dayText(fields.date), numberText(fields.amount)]),
  billingItemOf,
  (item) => filledFields({ item: item.item, date: item.date, amount: amountText(item.amount), client: item.client, description: item.description }),
)

/** What is to be invoiced. A client the clients tab does not name leaves the item out. */
export function readBillingPlan(read: RecordsRead<BillingItem>, clientSlugs: ReadonlySet<string>): Reading<BillingItem> {
  const sharesId = idSharing(read)
  const facts: BillingItem[] = []
  const problems: RecordProblem[] = refusedProblems(read)
  for (const stored of read.records) {
    if (!clientSlugs.has(stored.record.client)) {
      problems.push(problemOf(stored, `"${stored.record.client}" is not on the clients tab`))
    } else if (sharesId(stored)) {
      problems.push(problemOf(stored, SHARED_ID_REASON))
    } else {
      facts.push(stored.record)
    }
  }
  return { facts, problems }
}
