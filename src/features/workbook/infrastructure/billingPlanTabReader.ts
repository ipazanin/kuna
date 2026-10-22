import type { BillingItem } from '../domain/billingPlan'
import { isUnreadable, ownIdOf, positiveMoney, readRow, refuse, requiredDate, sharedIds, slugOf, tabReading, textOf } from './cellReading'
import type { RowProblem, TabReading } from './cellReading'
import type { SheetRow } from './workbookSnapshot'

/** The columns the app reads and writes. */
export const BILLING_PLAN_COLUMNS = ['item', 'date', 'amount', 'client', 'description'] as const

/** The `outgoing-plan` tab, its five columns and the id. A client the clients tab does not name leaves the row out. */
export function readBillingPlan(rows: readonly SheetRow[], clientSlugs: ReadonlySet<string>): TabReading<BillingItem> {
  const read: BillingItem[] = []
  const problems: RowProblem[] = []
  const shared = sharedIds(rows)
  for (const row of rows) {
    const item = readRow(() => readBillingPlanRow(row, clientSlugs, shared))
    if (isUnreadable(item)) {
      problems.push({ sheetRow: row.sheetRow, reason: item.unreadable })
    } else {
      read.push(item)
    }
  }
  return tabReading('outgoing-plan', rows, read, problems)
}

function readBillingPlanRow(row: SheetRow, clientSlugs: ReadonlySet<string>, shared: ReadonlySet<string>): BillingItem {
  const { cells } = row
  const item = textOf(cells.item)
  if (item === '') refuse('no item')
  const date = cells.date === undefined ? refuse('no date') : requiredDate(cells, 'date')
  const amount = positiveMoney(cells, 'amount')
  const client = slugOf(cells.client)
  if (client === '') refuse('no client')
  if (!clientSlugs.has(client)) refuse(`"${client}" is not on the clients tab`)
  return { item, date, amount, client, description: textOf(cells.description), id: ownIdOf('outgoing-plan', row, shared) }
}
