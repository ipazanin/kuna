import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { labelOrder } from '../../../../shared/categorising/domain/labels'
import type { Label } from '../../../../shared/categorising/domain/labels'
import type { Money } from '../../../../shared/money/money'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { bucketTotals } from '../../workbook/domain/bucketTotals'
import type { ProfitAndLoss } from '../../workbook/domain/bucketTotals'
import { itemIdOfRow } from '../../workbook/domain/splits'
import { bookingOfAdvance } from '../../workbook/domain/workbook'
import type { OwnerAdvance, Transaction } from '../../workbook/domain/workbook'

/** A label's figures, counted as the cash screens count profit and loss, over every part of a row that carries it. */
export interface LabelTotals {
  readonly label: Label
  readonly profitAndLoss: ProfitAndLoss
  /** The parts of rows and the advances that carry it, financing and neutral ones among them, which profit and loss counts nowhere, and a shared part once. */
  readonly parts: number
  /** The day of the newest part that carries it, or null for a label nothing carries. */
  readonly latest: CivilDate | null
}

/** The one figure a label leads with: its result, income less costs, or only its costs when it has no income, since a result would read a plain cost as a loss. */
export interface LabelFigure {
  readonly counts: 'result' | 'costs'
  readonly amount: Money
}

export function labelFigure(profitAndLoss: ProfitAndLoss): LabelFigure {
  if (profitAndLoss.income === 0) return { counts: 'costs', amount: profitAndLoss.cost }
  return { counts: 'result', amount: profitAndLoss.net }
}

/**
 * Every label with what it counts over the cash rows and the costs the owner paid privately, each split row as its parts and a
 * shared row's or advance's private share as owner pay, as `withOwnerParts` lists them. An advance counts as the cost it books.
 * Labels nothing carries come first, then by the day of their newest part, newest first.
 */
export function labelTotals(
  cashRows: readonly Transaction[],
  advances: readonly OwnerAdvance[],
  itemLabels: ReadonlyMap<RecordId, readonly RecordId[]>,
  labels: readonly Label[],
): readonly LabelTotals[] {
  return labels
    .map((label): LabelTotals => {
      const carried = cashRows.filter((row) => itemLabels.get(itemIdOfRow(row))?.includes(label.id) ?? false)
      const carriedAdvances = advances.filter((advance) => advance.labels?.includes(label.id) ?? false)
      const parts = new Set(carried.map(itemIdOfRow)).size + new Set(carriedAdvances.map((advance) => advance.id)).size
      const latest = [...carried, ...carriedAdvances].reduce<CivilDate | null>((newest, row) => (newest === null || row.date > newest ? row.date : newest), null)
      return { label, profitAndLoss: bucketTotals([...carried, ...carriedAdvances.map(bookingOfAdvance)]), parts, latest }
    })
    .sort(labelOrder)
}
