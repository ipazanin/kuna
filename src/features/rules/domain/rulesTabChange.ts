import { cellText } from '../../../shared/text/cellText'
import { filledFields } from '../../workbook/domain/recordFields'
import type { FieldValue } from '../../workbook/domain/recordFields'
import type { RuleTabRow } from './readRules'
import type { Rule, RuleCondition } from './rule'

export type RuleFields = RuleTabRow['fields']

/** One stored rule changed in place. */
export interface RuleRowEdit {
  /** The id the rule carries now, which finds it. */
  readonly id: string
  /** The rule's fields as the app last read them. The change is refused when the rules hold something else. */
  readonly expected: RuleFields
  /** The rule's fields after the change. A field left out ends up blank. */
  readonly fields: RuleFields
}

/** What a save does to the rules tab: at most one new row at the bottom, rows changed in place, and at most one row taken off. */
export interface RulesTabChange {
  readonly appended: RuleFields | null
  readonly edited: readonly RuleRowEdit[]
  /** The row to take off as the app last read it, which finds it by its id. The change is refused when the tab holds something else. */
  readonly removed: RuleFields | null
}

export interface RulesTabAfter {
  readonly rows: readonly RuleTabRow[]
  /** Why the change cannot be made to these rows. Empty when it can. */
  readonly refusals: readonly string[]
}

/**
 * The tab's rows with the change made, the new row below the last one. Each edited or removed row is
 * found by its id, once, and must still hold what the app read.
 */
export function rulesTabAfter(rows: readonly RuleTabRow[], change: RulesTabChange): RulesTabAfter {
  const refusals: string[] = []
  const rowHolding = (id: string, expected: RuleFields): RuleTabRow | null => {
    const matches = rows.filter((row) => sameId(row.fields.rule, id))
    if (matches.length !== 1) {
      refusals.push(
        matches.length === 0
          ? `no row on the rules tab has the id "${id}" any more`
          : `${matches.length} rows on the rules tab have the id "${id}", so the app cannot tell which to change`,
      )
      return null
    }
    const [row] = matches as [RuleTabRow]
    if (!sameFields(row.fields, expected)) {
      refusals.push(`rule "${id}" changed since the app last read it`)
      return null
    }
    return row
  }
  const replaced = new Map<RuleTabRow, RuleFields>()
  for (const edit of change.edited) {
    const row = rowHolding(edit.id, edit.expected)
    if (row !== null) replaced.set(row, filledFields(edit.fields))
  }
  const removed = change.removed === null ? null : rowHolding(cellText(change.removed.rule), change.removed)
  const changed = rows.filter((row) => row !== removed).map((row) => {
    const fields = replaced.get(row)
    return fields === undefined ? row : { fields }
  })
  const appended = change.appended === null ? [] : [{ fields: filledFields(change.appended) }]
  return { rows: [...changed, ...appended], refusals }
}

/** The fields a stored rule holds for this rule, blank fields left out. */
export function ruleFieldsOf(rule: Rule): RuleFields {
  const fields: Record<string, FieldValue> = {
    rule: rule.id,
    order: String(rule.order),
    enabled: rule.enabled,
    category: rule.category,
    confidence: rule.confidence,
    note: rule.note,
  }
  for (const condition of rule.conditions) {
    fields[condition.column] = conditionField(condition)
  }
  return filledFields(fields)
}

function conditionField(condition: RuleCondition): FieldValue {
  switch (condition.column) {
    case 'direction':
      return condition.direction
    case 'counterparty_iban':
      return condition.iban
    case 'has_counterparty_iban':
      return condition.present
    case 'counterparty_is_own':
    case 'counterparty_is_client':
    case 'is_card':
    case 'foreign_currency':
      return true
    case 'counterparty_contains':
    case 'description_contains':
    case 'description_starts_with':
      return condition.fragment
    case 'tx_domain':
    case 'tx_family':
    case 'tx_sub_family':
    case 'purpose':
    case 'revenue_code':
      return condition.code
  }
}

function sameFields(left: RuleFields, right: RuleFields): boolean {
  const names = new Set([...Object.keys(left), ...Object.keys(right)])
  return [...names].every((name) => cellText(left[name]) === cellText(right[name]))
}

/** Whether the field holds this rule id, compared without regard to case as the reader does. */
export function sameId(field: FieldValue | undefined, id: string): boolean {
  return cellText(field).toLowerCase() === id.trim().toLowerCase()
}
