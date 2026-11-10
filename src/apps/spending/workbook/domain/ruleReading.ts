import { ibanKey } from './accountReading'
import { flagOf, orderOf } from './fieldReading'
import { optionalReference, requiredReference } from './recordReference'
import { ACCOUNT_RECORDS, CATEGORY_RECORDS, RULE_RECORDS } from './spendingKinds'
import type { RuleWithdrawal, SpendingRule, SpendingRuleCondition } from './spendingRule'
import { words } from './words'
import { CONDITION_COLUMNS } from '../../../../shared/categorising/domain/rule'
import { withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { filledFields } from '../../../../shared/storage/domain/recordFields'
import { keyOfRecordId } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { ownId, refuse, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'

/** The one condition a stored rule states. Any other condition column is refused, so a rule never reads as wider than it is. */
function conditionOf(fields: StoredFields): SpendingRuleCondition {
  const other = CONDITION_COLUMNS.find((column) => column !== 'counterparty_contains' && column !== 'counterparty_iban' && fields[column] !== undefined)
  if (other !== undefined) refuse(words.ruleOtherCondition(other))
  const fragment = textOf(fields.counterparty_contains)
  const iban = ibanKey(textOf(fields.counterparty_iban))
  if ((fragment === '') === (iban === '')) refuse(words.ruleNeedsOneCondition)
  return fragment === '' ? { column: 'counterparty_iban', iban } : { column: 'counterparty_contains', fragment }
}

/** A withdrawal flag, with the cash account named only beside it. */
function withdrawalOf(fields: StoredFields): RuleWithdrawal | null {
  const cashAccount = optionalReference(fields, 'cash_account', ACCOUNT_RECORDS)
  if (!flagOf(fields, 'withdrawal')) return cashAccount === null ? null : refuse(words.cashAccountWithoutWithdrawal)
  return { cashAccount }
}

function ruleOf(fields: StoredFields, id: RecordId | null): SpendingRule {
  return {
    id: ownId(id),
    order: orderOf(fields, 'order'),
    condition: conditionOf(fields),
    category: requiredReference(fields, 'category', CATEGORY_RECORDS),
    withdrawal: withdrawalOf(fields),
  }
}

export const RULE_CODEC: RecordCodec<SpendingRule> = withIdField(RULE_RECORDS, words.ruleLabel, ruleOf, (rule) =>
  filledFields({
    order: String(rule.order),
    counterparty_contains: rule.condition.column === 'counterparty_contains' ? rule.condition.fragment : null,
    counterparty_iban: rule.condition.column === 'counterparty_iban' ? rule.condition.iban : null,
    category: keyOfRecordId(CATEGORY_RECORDS, rule.category),
    withdrawal: rule.withdrawal === null ? null : true,
    cash_account: rule.withdrawal?.cashAccount == null ? null : keyOfRecordId(ACCOUNT_RECORDS, rule.withdrawal.cashAccount),
  }),
)
