import type { BillingItem } from './billingPlan'
import { BILLING_RECORDS } from './coreKinds'
import { withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { amountText, filledFields } from '../../../../shared/storage/domain/recordFields'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { SHARED_ID_REASON, idSharing, problemOf, refusedProblems } from '../../../../shared/storage/domain/recordsRead'
import type { Reading, RecordProblem, RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import { ownId, positiveMoney, refuse, requiredDate, slugOf, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'
import { words } from './words'

export function billingItemOf(fields: StoredFields, id: RecordId | null): BillingItem {
  const item = textOf(fields.item)
  if (item === '') refuse(words.billing.noItem)
  const date = fields.date === undefined ? refuse(words.billing.noDate) : requiredDate(fields, 'date')
  const amount = positiveMoney(fields, 'amount')
  const client = slugOf(fields.client)
  if (client === '') refuse(words.billing.noClient)
  return { item, date, amount, client, description: textOf(fields.description), id: ownId(id) }
}

export const BILLING_CODEC: RecordCodec<BillingItem> = withIdField(BILLING_RECORDS, words.labels.billingItem, billingItemOf, (item) =>
  filledFields({ item: item.item, date: item.date, amount: amountText(item.amount), client: item.client, description: item.description }),
)

/** What is to be invoiced. A client the clients tab does not name leaves the item out. */
export function readBillingPlan(read: RecordsRead<BillingItem>, clientSlugs: ReadonlySet<string>): Reading<BillingItem> {
  const sharesId = idSharing(read)
  const facts: BillingItem[] = []
  const problems: RecordProblem[] = refusedProblems(read)
  for (const stored of read.records) {
    if (!clientSlugs.has(stored.record.client)) {
      problems.push(problemOf(stored, words.billing.clientMissing(stored.record.client)))
    } else if (sharesId(stored)) {
      problems.push(problemOf(stored, SHARED_ID_REASON))
    } else {
      facts.push(stored.record)
    }
  }
  return { facts, problems }
}
