import type { CivilDate } from '../../../shared/calendar/civilDate'
import { monthNumber, monthOf } from '../../../shared/calendar/monthKey'
import type { Money } from '../../../shared/money/money'
import type { Repository } from '../../../features/workbook/application/repository'
import { newRecordId, recordIdOf } from '../../../features/workbook/domain/recordId'
import { sameRecord } from '../../../features/workbook/domain/recordsRead'
import type { AssetGroup } from '../domain/assets/assets'
import type { PlanLine } from '../domain/forecast/plan'
import { PLAN_RECORDS } from '../domain/hrDooKinds'

/** A plan line before it is stored, so before it has an id. */
export type PlanLineDraft = PlanLine extends infer Each ? (Each extends PlanLine ? Omit<Each, 'id'> : never) : never

/** A category's plan for one month, or for every month with a null month. The amount is positive for income and costs alike. */
export function categoryPlanLine(year: number, month: number | null, category: string, amount: Money, note = ''): PlanLineDraft {
  return { kind: 'amount', year, month, item: category, amount, note: note.trim() }
}

export function dividendPlanLine(year: number, month: number, amount: Money, note = ''): PlanLineDraft {
  return { kind: 'amount', year, month, item: 'dividend', amount, note: note.trim() }
}

/** A purchase on the day it is bought and put in use, at its cost without the VAT reclaimed. It takes the month of its day. */
export function purchasePlanLine(year: number, date: CivilDate, amount: Money, group: AssetGroup, note: string): PlanLineDraft {
  return { kind: 'purchase', year, month: monthNumber(monthOf(date)), date, amount, group, note: note.trim() }
}

/** The scenario the year's owner pay follows, from 1 January or from the day it takes over. */
export function ownerPayPlanLine(year: number, scenario: string, from: CivilDate | null): PlanLineDraft {
  return { kind: 'owner-pay-scenario', year, month: null, scenario, from, note: '' }
}

/** A plan line under the key it is matched by, such as its month. */
export interface KeyedLine<Line> {
  readonly key: string
  readonly line: Line
}

/**
 * Turns the lines a part of the plan holds into the lines wanted: a key on both sides keeps its
 * line's id and changes it where it differs, a key only held is removed, and a key only wanted is
 * added with an id of its own.
 */
export function replacePlanLines(lines: Repository<PlanLine>, held: readonly KeyedLine<PlanLine>[], wanted: readonly KeyedLine<PlanLineDraft>[]): void {
  for (const { key, line } of wanted) {
    const holder = held.find((entry) => entry.key === key)?.line
    if (holder === undefined) {
      lines.add({ ...line, id: recordIdOf(PLAN_RECORDS, newRecordId()) })
    } else if (!sameRecord(holder, { ...line, id: holder.id })) {
      lines.change(holder, { ...line, id: holder.id })
    }
  }
  for (const { key, line } of held) {
    if (!wanted.some((entry) => entry.key === key)) {
      lines.remove(line)
    }
  }
}
