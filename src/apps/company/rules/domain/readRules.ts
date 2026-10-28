import { normaliseIban } from '../../../../shared/text/fold'
import { RULE_RECORDS } from '../../workbook/domain/coreKinds'
import { filledKey, labelWords } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { filledFields } from '../../../../shared/storage/domain/recordFields'
import type { FieldValue, RecordFields } from '../../../../shared/storage/domain/recordFields'
import { recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordProblem } from '../../../../shared/storage/domain/recordsRead'
import { sharedKeys } from '../../../../shared/storage/domain/sharedKeys'
import { slugOf, textOf as fieldTextOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'
import { CONDITION_COLUMNS, RULE_COLUMNS, inTryingOrder } from './rule'
import type { Rule, RuleCondition, RuleConfidence } from './rule'
import { foldRuleText } from './transactionFacts'

/** One stored rule as its fields, a flag as true or false and anything else as its text, blank fields left out. */
export interface RuleTabRow {
  readonly fields: RecordFields
}

/** A stored rule as its fields. The rules reader checks them, so the factory refuses none. */
function ruleRowOf(fields: StoredFields): RuleTabRow {
  return { fields: filledFields(Object.fromEntries(Object.entries(fields).map(([name, field]) => [name, field.flag ?? field.text]))) }
}

export const RULE_CODEC: RecordCodec<RuleTabRow> = {
  kind: RULE_RECORDS,
  key: (fields) => filledKey(slugOf(fields.rule)),
  label: (fields) => labelWords([fieldTextOf(fields.rule)]),
  make: ruleRowOf,
  fieldsOf: (row) => filledFields(row.fields),
}

export interface RulesRead {
  /** In the order they are tried. */
  readonly rules: readonly Rule[]
  /** Each names its rule by its id. */
  readonly problems: readonly RecordProblem[]
}

type ConditionColumnName = (typeof CONDITION_COLUMNS)[number]

/**
 * The `rules` tab, with each refusal a problem on its row rather than an error for the tab. A
 * refused row is left out, which hands its rows to the rules below it.
 *
 * Refused: an unknown column, no id or one on more than one row, every row of it, an order that is not a number, an enabled
 * cell that is not TRUE or FALSE, an enabled rule with no condition or an unreadable one, and a `rule`
 * confidence rule whose category `definedCategories` lacks. A `review` rule may name any category or
 * none. A disabled rule is checked for its id and order only, and keeps the conditions that read.
 */
export function readRules(rows: readonly RuleTabRow[], definedCategories: ReadonlySet<string>): RulesRead {
  const problems: RecordProblem[] = []
  const shared = sharedKeys(
    rows.filter((row) => textOf(row.fields.rule) !== ''),
    (row) => textOf(row.fields.rule).toLowerCase(),
  )
  const rules: Rule[] = []
  for (const row of rows) {
    const named = textOf(row.fields.rule)
    const refuse = (reason: string): void => {
      problems.push({ id: named === '' ? null : recordIdOf(RULE_RECORDS, named.toLowerCase()), label: named || 'unnamed', reason })
    }
    const unknownColumns = Object.keys(row.fields).filter((column) => !(RULE_COLUMNS as readonly string[]).includes(column))
    if (unknownColumns.length > 0) {
      refuse(`${unknownColumns.map((column) => `"${column}"`).join(', ')} is not a column a rule can test`)
      continue
    }
    const id = textOf(row.fields.rule)
    if (id === '') {
      refuse('a row without a rule id')
      continue
    }
    if (shared.has(id.toLowerCase())) {
      refuse('the id is on more than one row, so none of them is tried')
      continue
    }
    const orderCell = row.fields.order
    const order = Number(orderCell)
    if (textOf(orderCell) === '' || !Number.isFinite(order)) {
      refuse(`the order "${textOf(orderCell)}" is not a number`)
      continue
    }
    const enabled = booleanCell(row.fields.enabled)
    if (enabled === 'unreadable' || enabled === null) {
      refuse(`the enabled cell "${textOf(row.fields.enabled)}" is neither TRUE nor FALSE`)
      continue
    }
    const read = conditionsOf(row.fields)
    const category = textOf(row.fields.category).toLowerCase()
    const confidenceText = textOf(row.fields.confidence).toLowerCase()
    if (enabled) {
      const reasons = enabledRuleRefusals(confidenceText, category, read, definedCategories)
      if (reasons.length > 0) {
        reasons.forEach(refuse)
        continue
      }
    }
    const confidence: RuleConfidence = confidenceText === 'rule' ? 'rule' : 'review'
    rules.push({ id, order, enabled, conditions: read.conditions, category, confidence, note: textOf(row.fields.note) })
  }
  return { rules: inTryingOrder(rules), problems }
}

/** Why an enabled rule cannot be tried, the first check that fails, or none. */
function enabledRuleRefusals(
  confidence: string,
  category: string,
  read: ReturnType<typeof conditionsOf>,
  definedCategories: ReadonlySet<string>,
): string[] {
  if (confidence !== 'rule' && confidence !== 'review') {
    return [`the confidence "${confidence}" is neither rule nor review`]
  }
  if (confidence === 'rule' && !definedCategories.has(category)) {
    return [`it files rows as "${category}" at rule confidence, and the categories tab does not define it`]
  }
  if (read.unreadable.length > 0) {
    return read.unreadable
  }
  if (read.conditions.length === 0) {
    return ['no condition, so it would match every row']
  }
  return []
}

function conditionsOf(fields: RecordFields): { readonly conditions: RuleCondition[]; readonly unreadable: string[] } {
  const conditions: RuleCondition[] = []
  const unreadable: string[] = []
  for (const column of CONDITION_COLUMNS) {
    const cell = fields[column]
    if (cell === undefined || textOf(cell) === '') {
      continue
    }
    const condition = conditionOf(column, cell)
    if (typeof condition === 'string') {
      unreadable.push(condition)
    } else if (condition !== null) {
      conditions.push(condition)
    }
  }
  return { conditions, unreadable }
}

/** The condition one filled cell states, null for a cell that states none, or why it cannot be read. */
function conditionOf(column: ConditionColumnName, cell: FieldValue): RuleCondition | null | string {
  switch (column) {
    case 'direction': {
      const direction = textOf(cell).toLowerCase()
      return direction === 'credit' || direction === 'debit' ? { column, direction } : `direction is "${textOf(cell)}", and it is credit, debit or blank`
    }
    case 'counterparty_iban':
      return { column, iban: normaliseIban(textOf(cell)) }
    case 'has_counterparty_iban': {
      const present = booleanCell(cell)
      if (present === 'unreadable') {
        return `${column} is "${textOf(cell)}", and it is TRUE, FALSE or blank`
      }
      return present === null ? null : { column, present }
    }
    case 'counterparty_is_own':
    case 'counterparty_is_client':
    case 'is_card':
    case 'foreign_currency': {
      const wanted = booleanCell(cell)
      if (wanted === 'unreadable' || wanted === false) {
        return `${column} is "${textOf(cell)}", and it is TRUE or blank`
      }
      return wanted === null ? null : { column }
    }
    case 'counterparty_contains':
    case 'description_contains':
    case 'description_starts_with':
      return { column, fragment: foldRuleText(textOf(cell)) }
    case 'tx_domain':
    case 'tx_family':
    case 'tx_sub_family':
    case 'purpose':
      return { column, code: foldRuleText(textOf(cell)) }
    case 'revenue_code': {
      // Four digits and nothing else: a number drops a leading zero, and a three-digit code would match nothing.
      const code = textOf(cell)
      return /^\d{4}$/.test(code) ? { column, code } : `revenue_code is "${code}", and it is four digits`
    }
  }
}

/** TRUE, FALSE or blank. A checkbox reads as a boolean and a pasted TRUE as text, and both mean the same. */
function booleanCell(cell: FieldValue | undefined): boolean | null | 'unreadable' {
  if (typeof cell === 'boolean') {
    return cell
  }
  const text = textOf(cell).toUpperCase()
  if (text === '') {
    return null
  }
  if (text === 'TRUE' || text === 'FALSE') {
    return text === 'TRUE'
  }
  return 'unreadable'
}

function textOf(cell: FieldValue | undefined): string {
  return cell === undefined ? '' : String(cell).trim()
}
