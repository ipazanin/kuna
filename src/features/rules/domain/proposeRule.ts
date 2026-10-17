import type { Transaction, Workbook } from '../../workbook/domain/workbook'
import { categorise } from './categorise'
import { inTryingOrder } from './rule'
import type { Rule, RuleCondition } from './rule'
import { foldRuleText } from './transactionFacts'
import type { CategorisableTransaction, CategorisationContext } from './transactionFacts'

/** What separates a payee's name from a description carried in the same field. */
const DESCRIPTION_MARK = ' · '

/** The step the seeded orders use, so a rule placed at either end leaves room around it. */
const ORDER_STEP = 100

/** Roles of the categories that come in a credit and a debit pair, so one side of the pair never files the other. */
const DIRECTION_PAIRED_ROLES: ReadonlySet<string> = new Set(['revenue', 'client-refund', 'owner-loan-out', 'owner-loan-repaid', 'reimbursement'])

/**
 * A rule that files rows like this one in its category: by the counterparty IBAN when the row has
 * one, else by the counterparty's name as a merchant fragment, and by direction when the category
 * is one of a credit and debit pair. It goes just before the rule that decides the row today, or
 * last when none does. Null when the row's category is not defined or nothing names the counterparty.
 */
export function proposeRule(
  transaction: CategorisableTransaction & Pick<Transaction, 'category'>,
  workbook: Pick<Workbook, 'rules' | 'categories'>,
  context: CategorisationContext,
): Rule | null {
  const category = workbook.categories.find((candidate) => candidate.slug === transaction.category)
  if (category === undefined) {
    return null
  }
  const merchant = merchantFragment(transaction.counterparty)
  const identity: RuleCondition | null =
    transaction.counterpartyIban !== ''
      ? { column: 'counterparty_iban', iban: transaction.counterpartyIban }
      : merchant !== ''
        ? { column: 'counterparty_contains', fragment: merchant }
        : null
  if (identity === null) {
    return null
  }
  const directionPaired = category.roles.some((role) => DIRECTION_PAIRED_ROLES.has(role))
  const direction = transaction.amount > 0 ? 'credit' : 'debit'
  const conditions: RuleCondition[] = directionPaired ? [identity, { column: 'direction', direction }] : [identity]
  const stem = identity.column === 'counterparty_iban' ? `iban-${category.slug}` : `merchant-${slugOf(merchant)}`
  return {
    id: unusedId(directionPaired ? `${stem}-${direction}` : stem, workbook.rules),
    order: orderBeforeDecidingRule(transaction, workbook.rules, context),
    enabled: true,
    conditions,
    category: category.slug,
    confidence: 'rule',
    note:
      (identity.column === 'counterparty_iban'
        ? 'A counterparty whose account settles the category on its own.'
        : 'A merchant, by the name the bank puts in the counterparty field.') +
      (directionPaired ? ` Only ${direction === 'credit' ? 'credits' : 'debits'}, since the category is one side of a pair.` : ''),
    sheetRow: null,
  }
}

function merchantFragment(counterparty: string): string {
  const markAt = counterparty.indexOf(DESCRIPTION_MARK)
  return foldRuleText(markAt === -1 ? counterparty : counterparty.slice(0, markAt))
}

/**
 * Halfway between the deciding rule and the rule tried before it. Equal orders are tried by tab
 * row and a new rule lands last among them, so it goes below the last order that is lower.
 */
function orderBeforeDecidingRule(transaction: CategorisableTransaction, rules: readonly Rule[], context: CategorisationContext): number {
  const ordered = inTryingOrder(rules)
  const last = ordered[ordered.length - 1]
  if (last === undefined) {
    return ORDER_STEP
  }
  const deciding = ordered.find((rule) => rule.id === categorise(transaction, rules, context).ruleId)
  if (deciding === undefined) {
    return last.order + ORDER_STEP
  }
  const triedBefore = ordered.filter((rule) => rule.order < deciding.order)
  const lower = triedBefore[triedBefore.length - 1]
  return lower === undefined ? deciding.order - ORDER_STEP : (lower.order + deciding.order) / 2
}

function unusedId(stem: string, rules: readonly Rule[]): string {
  const taken = new Set(rules.map((rule) => rule.id.toLowerCase()))
  let id = stem
  for (let suffix = 2; taken.has(id); suffix += 1) {
    id = `${stem}-${suffix}`
  }
  return id
}

function slugOf(fragment: string): string {
  return fragment.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'counterparty'
}
