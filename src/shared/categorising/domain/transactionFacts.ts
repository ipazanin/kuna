import type { Money } from '../../money/money'
import { foldRuleText, normaliseIban } from '../../text/fold'

/** The fields of a bank row both apps' rules read. Each app's own row type carries them. */
export interface CategorisableRow {
  readonly amount: Money
  readonly counterparty: string
  readonly counterpartyIban: string
  readonly description: string
}

/** What both apps' rules test about one transaction, worked out once rather than per rule. */
export interface TransactionFacts {
  readonly isCredit: boolean
  readonly counterpartyIban: string
  readonly hasCounterpartyIban: boolean
  readonly counterparty: string
  readonly description: string
}

export function transactionFacts(transaction: CategorisableRow): TransactionFacts {
  const counterpartyIban = normaliseIban(transaction.counterpartyIban)
  return {
    // The ledger holds one signed amount, credits positive, so a zero amount reads as a debit.
    isCredit: transaction.amount > 0,
    counterpartyIban,
    hasCounterpartyIban: counterpartyIban !== '',
    counterparty: foldRuleText(transaction.counterparty),
    description: foldRuleText(transaction.description),
  }
}
