import { ACCOUNT_CODEC } from '../domain/accountReading'
import { BUDGET_CODEC } from '../domain/budgetReading'
import { CATEGORY_CODEC } from '../domain/categoryReading'
import { PART_CODEC } from '../domain/entryPartReading'
import { RECEIPT_CODEC } from '../domain/receiptReading'
import { RULE_CODEC } from '../domain/ruleReading'
import { SETTING_CODEC } from '../domain/spendingSettings'
import { TRANSACTION_CODEC } from '../domain/transactionReading'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import type { RecordKind } from '../../../../shared/storage/domain/recordKind'

const SPENDING_CODECS = [ACCOUNT_CODEC, CATEGORY_CODEC, TRANSACTION_CODEC, BUDGET_CODEC, RULE_CODEC, RECEIPT_CODEC, PART_CODEC, SETTING_CODEC] as readonly RecordCodec<unknown>[]

/** The codec of a Spending kind. Throws for a kind the Spending file does not keep. */
export function codecOfSpendingKind<R>(kind: RecordKind<R>): RecordCodec<R> {
  const codec = SPENDING_CODECS.find((candidate) => candidate.kind.name === kind.name)
  if (codec === undefined) {
    throw new Error(`The Spending file keeps no ${kind.noun.en.many}.`)
  }
  return codec as RecordCodec<R>
}
