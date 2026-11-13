import { ACCOUNT_CODEC } from '../domain/accountReading'
import { BUDGET_CODEC } from '../domain/budgetReading'
import { CATEGORY_CODEC } from '../domain/categoryReading'
import { ITEM_CODEC } from '../domain/transactionItemReading'
import { RECEIPT_CODEC } from '../domain/receiptReading'
import { RULE_CODEC } from '../domain/ruleReading'
import { SETTING_RECORDS } from '../domain/spendingKinds'
import { BANK_ACCOUNTS_KEEP_MINE_KEY, BANK_ACCOUNTS_NOT_IN_KUNA_KEY, BANK_SYNC_DEPLOYMENT_KEY, LINKABLE_BANKS, PERSON_PAYEES_KEY, bankFetchedKey, bankLinkKey } from '../domain/spendingSettings'
import { words } from '../domain/words'
import { words as accountWords } from '../../accounts/domain/words'
import { settingCodec } from '../../../../shared/storage/domain/settingRows'
import { HELD_ROW_CODEC, TRANSACTION_CODEC } from '../domain/transactionReading'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import type { RecordKind } from '../../../../shared/storage/domain/recordKind'

/** A setting's label in the language of the app, or the key of one Spending does not know. */
function settingLabel(key: string): string {
  const labels = words.settingLabels
  const named: Readonly<Record<string, string>> = {
    [BANK_SYNC_DEPLOYMENT_KEY]: labels.deployment,
    [PERSON_PAYEES_KEY]: labels.personPayees,
    [BANK_ACCOUNTS_NOT_IN_KUNA_KEY]: labels.notInKuna,
    [BANK_ACCOUNTS_KEEP_MINE_KEY]: labels.keepMine,
    ...Object.fromEntries(
      LINKABLE_BANKS.flatMap((bank) => [
        [bankLinkKey(bank), labels.bankLink(accountWords.banks[bank])],
        [bankFetchedKey(bank), labels.bankFetched(accountWords.banks[bank])],
      ]),
    ),
  }
  return named[key] ?? key
}

const SETTING_CODEC = settingCodec(SETTING_RECORDS, settingLabel)

const SPENDING_CODECS = [ACCOUNT_CODEC, CATEGORY_CODEC, TRANSACTION_CODEC, BUDGET_CODEC, RULE_CODEC, RECEIPT_CODEC, ITEM_CODEC, HELD_ROW_CODEC, SETTING_CODEC] as readonly RecordCodec<unknown>[]

/** The codec of a Spending kind. Throws for a kind the Spending file does not keep. */
export function codecOfSpendingKind<R>(kind: RecordKind<R>): RecordCodec<R> {
  const codec = SPENDING_CODECS.find((candidate) => candidate.kind.name === kind.name)
  if (codec === undefined) {
    throw new Error(`The Spending file keeps no ${kind.noun.en.many}.`)
  }
  return codec as RecordCodec<R>
}
