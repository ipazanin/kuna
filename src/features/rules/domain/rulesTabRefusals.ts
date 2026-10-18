import { columnLetter } from '../../../shared/text/columnLetter'
import { readRules } from './readRules'
import type { RuleTabRow } from './readRules'
import { RULE_COLUMNS } from './rule'

/** The columns `Rules.gs` requires on the tab. Every condition column is optional. */
const RULE_OUTCOME_COLUMNS = ['rule', 'order', 'enabled', 'category', 'confidence'] as const

/**
 * Everything the shadow-accounting Apps Script would refuse about this rules tab, mirroring
 * `parseRules` in `Rules.gs`: first the header (a column no rule can test, a missing outcome
 * column), then every row as `readRules` checks it. The Apps Script refuses the whole tab on any of
 * these, which stops the morning ingest, so the app writes nothing to a tab that has one.
 *
 * Headers are compared in lower case, as `parseRules` does. A row's cells are keyed by the header
 * as written, so a header such as `Rule` passes the header check and is then refused as an unknown
 * column, which is stricter than the Apps Script and never looser.
 */
export function rulesTabRefusals(header: readonly string[], rows: readonly RuleTabRow[], definedCategories: ReadonlySet<string>): string[] {
  const columns = header.map((name) => name.trim().toLowerCase())
  const refusals: string[] = []
  columns.forEach((column, index) => {
    if (column !== '' && !(RULE_COLUMNS as readonly string[]).includes(column)) {
      refusals.push(`column ${columnLetter(index + 1)} is headed "${column}", which no rule can test`)
    }
  })
  for (const column of RULE_OUTCOME_COLUMNS) {
    if (!columns.includes(column)) {
      refusals.push(`there is no "${column}" column`)
    }
  }
  if (refusals.length > 0) {
    return refusals
  }
  return readRules(rows, definedCategories).problems.map((problem) => `row ${problem.sheetRow}: ${problem.reason}`)
}
