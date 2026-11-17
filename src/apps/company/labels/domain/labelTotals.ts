import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { labelOrder } from '../../../../shared/categorising/domain/labels'
import type { Label } from '../../../../shared/categorising/domain/labels'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { bucketTotals } from '../../workbook/domain/bucketTotals'
import type { ProfitAndLoss } from '../../workbook/domain/bucketTotals'
import { itemIdOfRow } from '../../workbook/domain/splits'
import type { Transaction } from '../../workbook/domain/workbook'

/** A label's figures, counted as the cash screens count profit and loss, over every part of a row that carries it. */
export interface LabelTotals {
  readonly label: Label
  readonly profitAndLoss: ProfitAndLoss
  /** The parts of rows that carry it, financing and neutral ones among them, which profit and loss counts nowhere, and a shared part once. */
  readonly parts: number
  /** The day of the newest part that carries it, or null for a label nothing carries. */
  readonly latest: CivilDate | null
}

/**
 * Every label with what it counts over the cash rows, each split row as its parts and a shared row's private share as owner pay,
 * as `withOwnerParts` lists them. Labels nothing carries come first, then by the day of their newest part, newest first.
 */
export function labelTotals(cashRows: readonly Transaction[], itemLabels: ReadonlyMap<RecordId, readonly RecordId[]>, labels: readonly Label[]): readonly LabelTotals[] {
  return labels
    .map((label): LabelTotals => {
      const carried = cashRows.filter((row) => itemLabels.get(itemIdOfRow(row))?.includes(label.id) ?? false)
      const parts = new Set(carried.map(itemIdOfRow)).size
      const latest = carried.reduce<CivilDate | null>((newest, row) => (newest === null || row.date > newest ? row.date : newest), null)
      return { label, profitAndLoss: bucketTotals(carried), parts, latest }
    })
    .sort(labelOrder)
}
