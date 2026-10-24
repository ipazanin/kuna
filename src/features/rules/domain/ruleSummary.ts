import { cellText } from '../../../shared/text/cellText'
import type { CONDITION_COLUMNS, RuleCondition } from './rule'
import type { RuleRowEdit, RulesTabChange } from './rulesTabChange'

/** One condition as a reader would say it, such as `Counterparty contains "MODEL API"`. */
export function conditionInWords(condition: RuleCondition): string {
  switch (condition.column) {
    case 'direction':
      return condition.direction === 'credit' ? 'Money in' : 'Money out'
    case 'counterparty_iban':
      return `Counterparty IBAN is ${condition.iban}`
    case 'has_counterparty_iban':
      return condition.present ? 'Has a counterparty IBAN' : 'Has no counterparty IBAN'
    case 'counterparty_is_own':
      return 'Counterparty is one of your accounts'
    case 'counterparty_is_client':
      return 'Counterparty is a client'
    case 'counterparty_contains':
      return `Counterparty contains "${condition.fragment}"`
    case 'description_contains':
      return `Description contains "${condition.fragment}"`
    case 'description_starts_with':
      return `Description starts with "${condition.fragment}"`
    case 'tx_domain':
      return `Bank domain code is ${condition.code}`
    case 'tx_family':
      return `Bank family code is ${condition.code}`
    case 'tx_sub_family':
      return `Bank sub-family code is ${condition.code}`
    case 'purpose':
      return `Purpose code is ${condition.code}`
    case 'revenue_code':
      return `Revenue code is ${condition.code}`
    case 'is_card':
      return 'Card purchase'
    case 'foreign_currency':
      return 'In a foreign currency'
  }
}

/** What the form calls each condition column. */
export const CONDITION_LABELS: Readonly<Record<(typeof CONDITION_COLUMNS)[number], string>> = {
  direction: 'Direction',
  counterparty_iban: 'Counterparty IBAN is',
  has_counterparty_iban: 'Counterparty IBAN',
  counterparty_is_own: 'Counterparty is one of your accounts',
  counterparty_is_client: 'Counterparty is a client',
  counterparty_contains: 'Counterparty contains',
  description_contains: 'Description contains',
  description_starts_with: 'Description starts with',
  tx_domain: 'Bank domain code is',
  tx_family: 'Bank family code is',
  tx_sub_family: 'Bank sub-family code is',
  purpose: 'Purpose code is',
  revenue_code: 'Revenue code is',
  is_card: 'Card purchase',
  foreign_currency: 'In a foreign currency',
}

/** What a save did to the rules tab, in a few words, such as "Switched off merchant-telecom" or "Deleted merchant-telecom". */
export function rulesChangeInWords(change: RulesTabChange): string {
  const renumbered = (count: number): string => (count === 0 ? '' : `, and renumbered ${count} ${count === 1 ? 'rule' : 'rules'}`)
  if (change.appended !== null) {
    return `Added ${cellText(change.appended.rule)}${renumbered(change.edited.length)}`
  }
  if (change.removed !== null) {
    return `Deleted ${cellText(change.removed.rule)}`
  }
  const [first, ...others] = change.edited
  if (first === undefined) {
    return 'Changed no rule'
  }
  if (change.edited.every((edit) => changesOnly(edit, 'order'))) {
    const ahead = change.edited.find((edit) => orderOf(edit.cells) < orderOf(edit.expected))
    const behind = change.edited.find((edit) => edit !== ahead)
    return change.edited.length === 2 && ahead !== undefined && behind !== undefined
      ? `Moved ${idOf(ahead)} ahead of ${idOf(behind)}`
      : `Renumbered ${change.edited.length} rules`
  }
  if (others.length === 0 && changesOnly(first, 'enabled')) {
    return `${cellText(first.cells.enabled).toUpperCase() === 'FALSE' ? 'Switched off' : 'Switched on'} ${idOf(first)}`
  }
  return `Edited ${idOf(first)}: ${changedColumns(first).join(', ')}${renumbered(others.length)}`
}

function changedColumns(edit: RuleRowEdit): string[] {
  const columns = new Set([...Object.keys(edit.expected), ...Object.keys(edit.cells)])
  return [...columns].filter((column) => cellText(edit.expected[column]) !== cellText(edit.cells[column]))
}

function idOf(edit: RuleRowEdit): string {
  return cellText(edit.cells.rule) || edit.id
}

function orderOf(cells: RuleRowEdit['cells']): number {
  return Number(cellText(cells.order))
}

function changesOnly(edit: RuleRowEdit, column: string): boolean {
  const columns = changedColumns(edit)
  return columns.length === 1 && columns[0] === column
}
