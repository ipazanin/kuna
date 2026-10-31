import { cellText } from '../../../../shared/text/cellText'
import type { RuleCondition } from './rule'
import type { RuleRowEdit, RulesTabChange } from './rulesTabChange'
import { words } from './words'

/** One condition as a reader would say it, such as `Counterparty contains "MODEL API"`. */
export function conditionInWords(condition: RuleCondition): string {
  const said = words.conditions
  switch (condition.column) {
    case 'direction':
      return condition.direction === 'credit' ? said.moneyIn : said.moneyOut
    case 'counterparty_iban':
      return said.ibanIs(condition.iban)
    case 'has_counterparty_iban':
      return condition.present ? said.hasIban : said.hasNoIban
    case 'counterparty_is_own':
      return said.own
    case 'counterparty_is_client':
      return said.client
    case 'counterparty_contains':
      return said.counterpartyContains(condition.fragment)
    case 'description_contains':
      return said.descriptionContains(condition.fragment)
    case 'description_starts_with':
      return said.descriptionStartsWith(condition.fragment)
    case 'tx_domain':
      return said.domainIs(condition.code)
    case 'tx_family':
      return said.familyIs(condition.code)
    case 'tx_sub_family':
      return said.subFamilyIs(condition.code)
    case 'purpose':
      return said.purposeIs(condition.code)
    case 'revenue_code':
      return said.revenueCodeIs(condition.code)
    case 'is_card':
      return said.card
    case 'foreign_currency':
      return said.foreignCurrency
  }
}

/** What a save did to the rules tab, in a few words, such as "Switched off merchant-telecom" or "Deleted merchant-telecom". */
export function rulesChangeInWords(change: RulesTabChange): string {
  const said = words.changes
  if (change.appended !== null) {
    return said.added(cellText(change.appended.rule), said.renumbered(change.edited.length))
  }
  if (change.removed !== null) {
    return said.deleted(cellText(change.removed.rule))
  }
  const [first, ...others] = change.edited
  if (first === undefined) {
    return said.none
  }
  if (change.edited.every((edit) => changesOnly(edit, 'order'))) {
    const ahead = change.edited.find((edit) => orderOf(edit.fields) < orderOf(edit.expected))
    const behind = change.edited.find((edit) => edit !== ahead)
    return change.edited.length === 2 && ahead !== undefined && behind !== undefined ? said.moved(idOf(ahead), idOf(behind)) : said.renumberedRules(change.edited.length)
  }
  if (others.length === 0 && changesOnly(first, 'enabled')) {
    return said.switched(cellText(first.fields.enabled).toUpperCase() !== 'FALSE', idOf(first))
  }
  return said.edited(idOf(first), changedColumns(first), said.renumbered(others.length))
}

function changedColumns(edit: RuleRowEdit): string[] {
  const columns = new Set([...Object.keys(edit.expected), ...Object.keys(edit.fields)])
  return [...columns].filter((column) => cellText(edit.expected[column]) !== cellText(edit.fields[column]))
}

function idOf(edit: RuleRowEdit): string {
  return cellText(edit.fields.rule) || edit.id
}

function orderOf(fields: RuleRowEdit['fields']): number {
  return Number(cellText(fields.order))
}

function changesOnly(edit: RuleRowEdit, column: string): boolean {
  const columns = changedColumns(edit)
  return columns.length === 1 && columns[0] === column
}
