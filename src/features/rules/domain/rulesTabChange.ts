import { cellText } from '../../../shared/text/cellText'
import type { RuleTabRow } from './readRules'
import type { Rule, RuleCondition } from './rule'

export type RuleCells = RuleTabRow['cells']

/** One rules row changed in place. */
export interface RuleRowEdit {
  /** The id the row carries now, which finds it on the tab. */
  readonly id: string
  /** The row's cells as the app last read them. The change is refused when the tab holds something else. */
  readonly expected: RuleCells
  /** The row's cells after the change. A column left out ends up blank. */
  readonly cells: RuleCells
}

/** What a save does to the rules tab: at most one new row at the bottom, and rows changed in place. */
export interface RulesTabChange {
  readonly appended: RuleCells | null
  readonly edited: readonly RuleRowEdit[]
}

export interface RulesTabAfter {
  readonly rows: readonly RuleTabRow[]
  /** Why the change cannot be made to these rows. Empty when it can. */
  readonly refusals: readonly string[]
}

/**
 * The tab's rows with the change made, the new row below the last one. Each edited row is found by
 * its id, once, and must still hold what the app read.
 */
export function rulesTabAfter(rows: readonly RuleTabRow[], change: RulesTabChange): RulesTabAfter {
  const refusals: string[] = []
  const replaced = new Map<RuleTabRow, RuleCells>()
  for (const edit of change.edited) {
    const matches = rows.filter((row) => sameId(row.cells.rule, edit.id))
    if (matches.length !== 1) {
      refusals.push(
        matches.length === 0
          ? `no row on the rules tab has the id "${edit.id}" any more`
          : `${matches.length} rows on the rules tab have the id "${edit.id}", so the app cannot tell which to change`,
      )
      continue
    }
    const [row] = matches as [RuleTabRow]
    if (!sameCells(row.cells, edit.expected)) {
      refusals.push(`rule "${edit.id}" changed since the app last read it`)
      continue
    }
    replaced.set(row, withoutBlanks(edit.cells))
  }
  const changed = rows.map((row) => {
    const cells = replaced.get(row)
    return cells === undefined ? row : { cells }
  })
  const appended = change.appended === null ? [] : [{ cells: withoutBlanks(change.appended) }]
  return { rows: [...changed, ...appended], refusals }
}

/** The cells a rules row holds for this rule, blank cells left out. */
export function ruleTabCells(rule: Rule): RuleCells {
  const cells: Record<string, string | number | boolean> = {
    rule: rule.id,
    order: rule.order,
    enabled: rule.enabled,
    category: rule.category,
    confidence: rule.confidence,
    note: rule.note,
  }
  for (const condition of rule.conditions) {
    cells[condition.column] = conditionCell(condition)
  }
  return withoutBlanks(cells)
}

function conditionCell(condition: RuleCondition): string | boolean {
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

export function sameCells(left: RuleCells, right: RuleCells): boolean {
  const columns = new Set([...Object.keys(left), ...Object.keys(right)])
  return [...columns].every((column) => cellText(left[column]) === cellText(right[column]))
}

/** Whether the cell holds this rule id, compared without regard to case as `Rules.gs` does. */
export function sameId(cell: string | number | boolean | undefined, id: string): boolean {
  return cellText(cell).toLowerCase() === id.trim().toLowerCase()
}

function withoutBlanks(cells: RuleCells): RuleCells {
  return Object.fromEntries(Object.entries(cells).filter(([, cell]) => cellText(cell) !== ''))
}
