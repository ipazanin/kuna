import { RECEIVABLE_ROLES } from '../../receivables/domain/invoiceMatching'
import { counterpartyIdentity } from '../../workbook/domain/counterpartyIdentity'
import type { Transaction, Workbook } from '../../workbook/domain/workbook'
import { categorise } from '../../../../shared/categorising/domain/categorise'
import { placeBefore } from './rulePlacement'
import type { Rule, RuleCondition } from '../../../../shared/categorising/domain/rule'
import { fold, foldRuleText } from '../../../../shared/text/fold'
import type { CategorisableRow, CategorisationContext } from '../../../../shared/categorising/domain/transactionFacts'

/**
 * A rule that files rows like this one in its category: by the counterparty IBAN when the row has
 * one, else by the counterparty's name as a merchant fragment, and by direction when the category
 * is one of a credit and debit pair. A card purchase settled against the bank's own account goes
 * by the merchant after the description mark, since the IBAN is the bank's. It goes just before
 * the rule that decides the row today, or last when none does. Where that needs other rules
 * renumbered, the order here ties and the save renumbers them. Null when the row's category is not defined or nothing names the counterparty.
 * `packPairedRoles` are the installed pack's roles of categories that come in a credit and a debit pair,
 * beside core's revenue and client refund, so one side of a pair never files the other.
 */
export function proposeRule(
  transaction: CategorisableRow & Pick<Transaction, 'category'>,
  workbook: Pick<Workbook, 'rules' | 'categories'>,
  context: CategorisationContext,
  packPairedRoles: readonly string[],
): Rule | null {
  const category = workbook.categories.find((candidate) => candidate.slug === transaction.category)
  if (category === undefined) {
    return null
  }
  const counterparty = counterpartyIdentity(transaction, context.cardSettlementIbans)
  const merchant = foldRuleText(counterparty.writtenName)
  const identity: RuleCondition | null =
    counterparty.iban !== '' ? { column: 'counterparty_iban', iban: counterparty.iban } : merchant !== '' ? { column: 'counterparty_contains', fragment: merchant } : null
  if (identity === null) {
    return null
  }
  const paired = new Set([...Object.values(RECEIVABLE_ROLES), ...packPairedRoles])
  const directionPaired = category.roles.some((role) => paired.has(role))
  const direction = transaction.amount > 0 ? 'credit' : 'debit'
  const conditions: RuleCondition[] = directionPaired ? [identity, { column: 'direction', direction }] : [identity]
  const stem = identity.column === 'counterparty_iban' ? `iban-${category.slug}` : `merchant-${slugOf(merchant)}`
  return {
    id: unusedId(directionPaired ? `${stem}-${direction}` : stem, workbook.rules),
    order: placeBefore(workbook.rules, null, categorise(transaction, workbook.rules, context).ruleId).order,
    enabled: true,
    conditions,
    category: category.slug,
    confidence: 'rule',
    note:
      (identity.column === 'counterparty_iban' ? 'A counterparty whose account settles the category on its own.' : 'A merchant, by the name the bank puts in the counterparty field.') +
      (directionPaired ? ` Only ${direction === 'credit' ? 'credits' : 'debits'}, since the category is one side of a pair.` : ''),
  }
}

export function unusedId(stem: string, rules: readonly Rule[]): string {
  const taken = new Set(rules.map((rule) => rule.id.toLowerCase()))
  let id = stem
  for (let suffix = 2; taken.has(id); suffix += 1) {
    id = `${stem}-${suffix}`
  }
  return id
}

/** The most words of a payee or account holder a rule's name takes, so a long company name stays readable. */
const MOST_HOLDER_WORDS = 4

/**
 * A rule's name from its category and the payee or account holder it files, such as `donations-rk-cetina-raft`, unused
 * among the rules. Accents go, and so do single letters such as those of d.o.o. and anything but letters and digits. With no holder it is the category alone.
 */
export function ruleNameOf(category: string, holder: string, rules: readonly Rule[]): string {
  const holderWords = fold(holder)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1)
    .slice(0, MOST_HOLDER_WORDS)
  const categoryWords = fold(category)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word !== '')
  return unusedId([...categoryWords, ...holderWords].join('-') || 'rule', rules)
}

function slugOf(fragment: string): string {
  return (
    fragment
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'counterparty'
  )
}
