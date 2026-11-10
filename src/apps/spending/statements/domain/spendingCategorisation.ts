import { sameMoney, typedRowsOf } from '../../pairing/domain/sameMoney'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import type { SpendingRule } from '../../workbook/domain/spendingRule'
import type { Transaction } from '../../workbook/domain/transaction'
import { categorise } from '../../../../shared/categorising/domain/categorise'
import { inTryingOrder } from '../../../../shared/categorising/domain/rule'
import type { Rule, RuleCondition } from '../../../../shared/categorising/domain/rule'
import type { CategorisableRow, CategorisationContext, TransactionSignals } from '../../../../shared/categorising/domain/transactionFacts'
import { EURO } from '../../../../shared/money/currencyCode'
import { moneyFromCents } from '../../../../shared/money/money'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { foldRuleText, normaliseIban } from '../../../../shared/text/fold'

const NO_SIGNALS: TransactionSignals = { purpose: '', txDomain: '', txFamily: '', txSubFamily: '', creditorReference: '', instructedCurrency: '' }

/** What the rules know of the owner: the accounts' IBANs as own and each account's currency. Personal money has no clients and no card settlement accounts. */
export function spendingCategorisationContext(book: Pick<SpendingBook, 'accounts'>): CategorisationContext {
  return {
    ownIbans: new Set(book.accounts.flatMap((account) => (account.iban === '' ? [] : [normaliseIban(account.iban)]))),
    clientIbans: new Set(),
    cardSettlementIbans: new Set(),
    accountCurrencies: new Map(book.accounts.map((account) => [account.id, account.currency])),
    defaultCurrency: EURO,
  }
}

/**
 * The rule as the shared core tries it, its text folded as the core reads a row's. A rule on an income category holds only for
 * money in, so a later purchase from that payee waits on review, and one that spots a withdrawal only for money out.
 */
function sharedRuleOf(rule: SpendingRule, incomeCategories: ReadonlySet<RecordId>): Rule {
  const { condition } = rule
  const tested: RuleCondition =
    condition.column === 'counterparty_iban' ? { column: condition.column, iban: normaliseIban(condition.iban) } : { column: condition.column, fragment: foldRuleText(condition.fragment) }
  const direction: readonly RuleCondition[] = incomeCategories.has(rule.category)
    ? [{ column: 'direction', direction: 'credit' }]
    : rule.withdrawal !== null
      ? [{ column: 'direction', direction: 'debit' }]
      : []
  return {
    id: rule.id,
    order: rule.order,
    enabled: true,
    conditions: [tested, ...direction],
    category: rule.category,
    confidence: 'rule',
    note: '',
  }
}

/** What the rules read of a row. */
export type RuledRow = Pick<Transaction, 'account' | 'amount' | 'payee' | 'counterpartyIban' | 'description'>

/** Finds the rule that decides a row: the first of a set that holds, or null. */
export function decidingRule(rules: readonly SpendingRule[], book: Pick<SpendingBook, 'accounts' | 'categories'>): (row: RuledRow) => SpendingRule | null {
  const context = spendingCategorisationContext(book)
  const incomeCategories = new Set(book.categories.filter((category) => category.kind === 'income').map((category) => category.id))
  const shared = inTryingOrder(rules.map((rule) => sharedRuleOf(rule, incomeCategories)))
  const ruleOf = new Map<string, SpendingRule>(rules.map((rule) => [rule.id, rule]))
  return (row) => {
    const categorisable: CategorisableRow = {
      account: row.account,
      amount: moneyFromCents(row.amount),
      counterparty: row.payee,
      counterpartyIban: row.counterpartyIban,
      description: row.description,
      signals: NO_SIGNALS,
    }
    const { ruleId } = categorise(categorisable, shared, context)
    return ruleId === null ? null : (ruleOf.get(ruleId) ?? null)
  }
}

/** Decides rows by a set of rules: the category of the first rule that holds, or null. */
export function ruleVerdicts(rules: readonly SpendingRule[], book: Pick<SpendingBook, 'accounts' | 'categories'>): (row: RuledRow) => RecordId | null {
  const ruleOf = decidingRule(rules, book)
  return (row) => ruleOf(row)?.category ?? null
}

/** One row a rule change refiles. */
export interface RowChange {
  readonly before: Transaction
  readonly after: Transaction
}

/**
 * What a set of rules does to the file: a row a rule filed follows the rules, back to waiting when none holds any more,
 * and a row waiting on review takes the first rule that holds. A row you set, or that the file reader or the pairing
 * filed, stays as it is, and so does a row To review offers as the same money as a typed row, until you answer.
 */
export function rulesRerun(book: Pick<SpendingBook, 'accounts' | 'categories' | 'transactions'>, rules: readonly SpendingRule[]): readonly RowChange[] {
  const categoryOf = ruleVerdicts(rules, book)
  const { matches, near } = sameMoney(
    typedRowsOf(book),
    book.transactions.filter((row) => row.source === 'statement' && row.category === null),
  )
  const offered = new Set([...matches, ...near].map(({ bank }) => bank))
  return book.transactions.flatMap((before) => {
    const waiting = before.category === null && before.categorisedBy === null
    if ((before.categorisedBy !== 'rule' && !waiting) || offered.has(before)) return []
    const category = categoryOf(before)
    return category === before.category ? [] : [{ before, after: { ...before, category, categorisedBy: category === null ? null : ('rule' as const) } }]
  })
}
