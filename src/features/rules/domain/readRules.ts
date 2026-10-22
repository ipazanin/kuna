import { normaliseIban } from '../../../shared/text/fold'
import { recordIdOf } from '../../workbook/domain/recordId'
import { RULE_RECORDS } from '../../workbook/domain/recordKind'
import { sharedKeys } from '../../workbook/domain/sharedKeys'
import type { RecordProblem } from '../../workbook/domain/workbook'
import { CONDITION_COLUMNS, RULE_COLUMNS, inTryingOrder } from './rule'
import type { Rule, RuleCondition, RuleConfidence } from './rule'
import { foldRuleText } from './transactionFacts'

/** One data row of the `rules` tab, keyed by header, with blank cells left out. */
export interface RuleTabRow {
  readonly cells: Readonly<Record<string, string | number | boolean>>
}

export interface RulesRead {
  /** In the order they are tried. */
  readonly rules: readonly Rule[]
  /** Each names its rule by its id. */
  readonly problems: readonly RecordProblem[]
}

type ConditionColumnName = (typeof CONDITION_COLUMNS)[number]

/**
 * The `rules` tab as `Rules.gs` reads it, with each refusal a problem on its row rather than an
 * error for the tab. A refused row is left out, which hands its rows to the rules below it, so the
 * Apps Script would refuse the whole tab where this reports a problem.
 *
 * Refused: an unknown column, no id or one on more than one row, every row of it, an order that is not a number, an enabled
 * cell that is not TRUE or FALSE, an enabled rule with no condition or an unreadable one, a `rule`
 * confidence rule whose category `definedCategories` lacks, and an enabled rule that tests
 * `counterparty_is_client` in a workbook without a clients tab, which stops the Apps Script's
 * `categorisationContext` before a row is filed. A `review` rule may name any category or none. A
 * disabled rule is checked for its id and order only, and keeps the conditions that read.
 */
export function readRules(rows: readonly RuleTabRow[], definedCategories: ReadonlySet<string>, hasClientsTab: boolean): RulesRead {
  const problems: RecordProblem[] = []
  const shared = sharedKeys(
    rows.filter((row) => textOf(row.cells.rule) !== ''),
    (row) => textOf(row.cells.rule).toLowerCase(),
  )
  const rules: Rule[] = []
  for (const row of rows) {
    const named = textOf(row.cells.rule)
    const refuse = (reason: string): void => {
      problems.push({ id: named === '' ? null : recordIdOf(RULE_RECORDS, named.toLowerCase()), label: named || 'unnamed', reason })
    }
    const unknownColumns = Object.keys(row.cells).filter((column) => !(RULE_COLUMNS as readonly string[]).includes(column))
    if (unknownColumns.length > 0) {
      refuse(`${unknownColumns.map((column) => `"${column}"`).join(', ')} is not a column a rule can test`)
      continue
    }
    const id = textOf(row.cells.rule)
    if (id === '') {
      refuse('a row without a rule id')
      continue
    }
    if (shared.has(id.toLowerCase())) {
      refuse('the id is on more than one row, so none of them is tried')
      continue
    }
    const orderCell = row.cells.order
    const order = Number(orderCell)
    if (textOf(orderCell) === '' || !Number.isFinite(order)) {
      refuse(`the order "${textOf(orderCell)}" is not a number`)
      continue
    }
    const enabled = booleanCell(row.cells.enabled)
    if (enabled === 'unreadable' || enabled === null) {
      refuse(`the enabled cell "${textOf(row.cells.enabled)}" is neither TRUE nor FALSE`)
      continue
    }
    const read = conditionsOf(row.cells)
    const category = textOf(row.cells.category).toLowerCase()
    const confidenceText = textOf(row.cells.confidence).toLowerCase()
    if (enabled) {
      const reasons = enabledRuleRefusals(confidenceText, category, read, definedCategories, hasClientsTab)
      if (reasons.length > 0) {
        reasons.forEach(refuse)
        continue
      }
    }
    const confidence: RuleConfidence = confidenceText === 'rule' ? 'rule' : 'review'
    rules.push({ id, order, enabled, conditions: read.conditions, category, confidence, note: textOf(row.cells.note) })
  }
  return { rules: inTryingOrder(rules), problems }
}

/** Why an enabled rule cannot be tried, the first check that fails, or none. */
function enabledRuleRefusals(
  confidence: string,
  category: string,
  read: ReturnType<typeof conditionsOf>,
  definedCategories: ReadonlySet<string>,
  hasClientsTab: boolean,
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
  if (!hasClientsTab && read.conditions.some((condition) => condition.column === 'counterparty_is_client')) {
    return [`it tests counterparty_is_client, and the workbook has no clients tab with client and iban columns to answer it. Add the tab, or name the client by counterparty_iban`]
  }
  return []
}

function conditionsOf(cells: RuleTabRow['cells']): { readonly conditions: RuleCondition[]; readonly unreadable: string[] } {
  const conditions: RuleCondition[] = []
  const unreadable: string[] = []
  for (const column of CONDITION_COLUMNS) {
    const cell = cells[column]
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
function conditionOf(column: ConditionColumnName, cell: string | number | boolean): RuleCondition | null | string {
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
      // Four digits and nothing else: a cell that is not text drops a leading zero, and a three-digit code would match nothing.
      const code = textOf(cell)
      return /^\d{4}$/.test(code) ? { column, code } : `revenue_code is "${code}", and it is four digits`
    }
  }
}

/** TRUE, FALSE or blank. A checkbox reads as a boolean and a pasted TRUE as text, and both mean the same. */
function booleanCell(cell: string | number | boolean | undefined): boolean | null | 'unreadable' {
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

function textOf(cell: string | number | boolean | undefined): string {
  return cell === undefined ? '' : String(cell).trim()
}
