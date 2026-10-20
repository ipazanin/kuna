import { yearOf } from '../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../shared/calendar/civilDate'
import { monthNumber, monthOf } from '../../../shared/calendar/monthKey'
import { ASSET_GROUPS } from '../domain/assets'
import { PLAN_KEYWORDS } from '../domain/plan'
import type { PlanLine } from '../domain/plan'
import { inTabOrder, isUnreadable, optionalDate, positiveMoney, readRow, refuse, requiredChoice, requiredMoney, requiredYear, slugOf, textOf, wholeNumberOf } from './cellReading'
import type { RowProblem, TabReading } from './cellReading'
import type { SheetRow } from './workbookSnapshot'

/**
 * The `plan` tab. A category or dividend row is listed once per year and month, and an
 * `owner_pay_scenario` row once per year and starting day. A purchase may repeat, since two
 * purchases can share a day. An item must be a keyword or a category on the categories tab, and an
 * `owner_pay_scenario` row must name a scenario on the scenarios tab, or the row is left out.
 * Planned revenue lives on the `outgoing-plan` tab, so a `revenue` row is left out with a problem
 * that says to move it there. Rules across rows, such as one dividend a year, are the plan guards'.
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
    const key = keyOf(line)
    if (key !== null && seen.has(key.text)) {
      problems.push({ sheetRow: row.sheetRow, reason: `${key.words} is already listed above` })
      continue
    }
    if (key !== null) {
      seen.add(key.text)
    }
    facts.push(line)
  }
  return { facts, problems }
}

function keyOf(line: PlanLine): { readonly text: string; readonly words: string } | null {
  switch (line.kind) {
    case 'purchase':
      return null
    case 'owner-pay-scenario':
      return { text: `${line.year} owner_pay_scenario ${line.from ?? 'start'}`, words: `An owner pay scenario from ${line.from ?? `1 January ${line.year}`}` }
    case 'amount':
      return { text: `${line.year} ${line.month ?? 'every'} ${line.item}`, words: `${line.item} for ${line.month === null ? 'every month of' : `month ${line.month} of`} ${line.year}` }
  }
}

function readPlanRow(row: SheetRow, categorySlugs: ReadonlySet<string>, scenarioSlugs: ReadonlySet<string>): PlanLine {
  const { cells } = row
  const year = requiredYear(cells, 'year')
  const month = cells.month === undefined ? null : wholeNumberOf(cells.month)
  if (cells.month !== undefined && (month === null || month < 1 || month > 12)) refuse(`month "${textOf(cells.month)}" is not a month from 1 to 12`)
  const note = textOf(cells.note)
  const item = slugOf(cells.item)
  if (item === '') refuse('no item')
  if (item === 'revenue') refuse('revenue is planned on the outgoing-plan tab, one row per item to invoice, so move this row there')
  if (item === 'owner_pay_scenario') {
    if (month !== null) refuse('an owner pay scenario holds from its date, so leave month blank')
    const scenario = slugOf(cells.amount)
    if (scenario === '') refuse('no scenario in amount')
    if (!scenarioSlugs.has(scenario)) refuse(`"${scenario}" is not a scenario on the scenarios tab`)
    const from = optionalDate(cells, 'date')
    return { year, month: null, note, sheetRow: row.sheetRow, kind: 'owner-pay-scenario', scenario, from: from === null ? null : inYear(from, year) }
  }
  if (item === 'purchase') {
    const date = inYear(optionalDate(cells, 'date') ?? refuse('a purchase needs the day it is bought in date'), year)
    const dateMonth = monthNumber(monthOf(date))
    if (month !== null && month !== dateMonth) refuse(`month ${month} is not the month of date ${date}, so leave month blank`)
    return { year, month: dateMonth, note, sheetRow: row.sheetRow, kind: 'purchase', date, amount: positiveMoney(cells, 'amount'), group: requiredChoice(cells, 'group', ASSET_GROUPS, 'asset group') }
  }
  if (!(PLAN_KEYWORDS as readonly string[]).includes(item) && !categorySlugs.has(item)) {
    refuse(`"${item}" is neither ${PLAN_KEYWORDS.join(', ')} nor a category on the categories tab`)
  }
  if (item === 'dividend') {
    if (month === null) refuse('a dividend is paid in one month, so give its month')
    return { year, month, note, sheetRow: row.sheetRow, kind: 'amount', item, amount: positiveMoney(cells, 'amount') }
  }
  return { year, month, note, sheetRow: row.sheetRow, kind: 'amount', item, amount: requiredMoney(cells, 'amount') }
}

function inYear(day: CivilDate, year: number): CivilDate {
  return yearOf(day) === year ? day : refuse(`date ${day} is not in ${year}`)
}
