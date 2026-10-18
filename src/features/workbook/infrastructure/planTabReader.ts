import { PLAN_KEYWORDS } from '../domain/plan'
import type { PlanLine } from '../domain/plan'
import { inTabOrder, isUnreadable, readRow, refuse, requiredMoney, requiredYear, slugOf, textOf, wholeNumberOf } from './cellReading'
import type { RowProblem, TabReading } from './cellReading'
import type { SheetRow } from './workbookSnapshot'

/**
 * The `plan` tab, one row per year, month and item. A key used twice is left out the second time.
 * An item must be a keyword or a category on the categories tab, and an `owner_pay_scenario` row
 * must name a scenario on the scenarios tab, or the row is left out.
 */
export function readPlan(rows: readonly SheetRow[], categorySlugs: ReadonlySet<string>, scenarioSlugs: ReadonlySet<string>): TabReading<PlanLine> {
  const facts: PlanLine[] = []
  const problems: RowProblem[] = []
  const seen = new Set<string>()
  for (const row of inTabOrder(rows)) {
    const line = readRow(() => readPlanRow(row, categorySlugs, scenarioSlugs))
    if (isUnreadable(line)) {
      problems.push({ sheetRow: row.sheetRow, reason: line.unreadable })
      continue
    }
    const item = line.kind === 'amount' ? line.item : 'owner_pay_scenario'
    const key = `${line.year} ${line.month ?? 'every'} ${item}`
    if (seen.has(key)) {
      problems.push({ sheetRow: row.sheetRow, reason: `${item} for ${line.month === null ? 'every month of' : `month ${line.month} of`} ${line.year} is already listed above` })
      continue
    }
    seen.add(key)
    facts.push(line)
  }
  return { facts, problems }
}

function readPlanRow(row: SheetRow, categorySlugs: ReadonlySet<string>, scenarioSlugs: ReadonlySet<string>): PlanLine {
  const { cells } = row
  const year = requiredYear(cells, 'year')
  const month = cells.month === undefined ? null : wholeNumberOf(cells.month)
  if (cells.month !== undefined && (month === null || month < 1 || month > 12)) refuse(`month "${textOf(cells.month)}" is not a month from 1 to 12`)
  const timing = { year, month, note: textOf(cells.note), sheetRow: row.sheetRow }
  const item = slugOf(cells.item)
  if (item === '') refuse('no item')
  if (item === 'owner_pay_scenario') {
    const scenario = slugOf(cells.amount)
    if (scenario === '') refuse('no scenario in amount')
    if (!scenarioSlugs.has(scenario)) refuse(`"${scenario}" is not a scenario on the scenarios tab`)
    return { ...timing, kind: 'owner-pay-scenario', scenario }
  }
  if (!(PLAN_KEYWORDS as readonly string[]).includes(item) && !categorySlugs.has(item)) {
    refuse(`"${item}" is neither ${PLAN_KEYWORDS.join(', ')} nor a category on the categories tab`)
  }
  return { ...timing, kind: 'amount', item, amount: requiredMoney(cells, 'amount') }
}
