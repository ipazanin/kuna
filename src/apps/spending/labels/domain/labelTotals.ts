import { partTotals } from '../../analytics/domain/partTotals'
import type { PartTotals } from '../../analytics/domain/partTotals'
import type { EuroRow } from '../../rates/domain/euroRows'
import type { Category } from '../../workbook/domain/category'
import { labelOrder } from '../../../../shared/categorising/domain/labels'
import type { Label } from '../../../../shared/categorising/domain/labels'

/** A label's figures, counted as Spending's month counts them, over every part that carries it. */
export interface LabelTotals extends PartTotals {
  readonly label: Label
}

/**
 * Every label with what it counts, those no row carries first, then by the day of their newest row, newest first, and by name
 * within a day.
 */
export function labelTotals(rows: readonly EuroRow[], categories: readonly Category[], labels: readonly Label[]): readonly LabelTotals[] {
  const byId = new Map(categories.map((category) => [category.id, category]))
  const totals = labels.map((label): LabelTotals => ({ label, ...partTotals(rows, byId, (row, _part, place) => row.items[place]!.labels.includes(label.id)) }))
  return totals.sort(labelOrder)
}
