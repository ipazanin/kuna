import type { BillingItem } from '../domain/billingPlan'
import { inTabOrder, isUnreadable, positiveMoney, readRow, refuse, requiredDate, slugOf, textOf } from './cellReading'
import type { RowProblem, TabReading } from './cellReading'
import type { SheetRow } from './workbookSnapshot'

/** The columns the app reads and writes. */
export const BILLING_PLAN_COLUMNS = ['item', 'date', 'amount', 'client', 'description'] as const

/** The `outgoing-plan` tab, its five columns only. A client the clients tab does not name leaves the row out. */
export function readBillingPlan(rows: readonly SheetRow[], clientSlugs: ReadonlySet<string>): TabReading<BillingItem> {
  const facts: BillingItem[] = []
  const problems: RowProblem[] = []
  for (const row of inTabOrder(rows)) {
    const item = readRow(() => readBillingPlanRow(row, clientSlugs))
    if (isUnreadable(item)) {
      problems.push({ sheetRow: row.sheetRow, reason: item.unreadable })
    } else {
      facts.push(item)
    }
  }
  return { facts, problems }
}

function readBillingPlanRow(row: SheetRow, clientSlugs: ReadonlySet<string>): BillingItem {
  const { cells } = row
  const item = textOf(cells.item)
  if (item === '') refuse('no item')
  const date = cells.date === undefined ? refuse('no date') : requiredDate(cells, 'date')
  const amount = positiveMoney(cells, 'amount')
  const client = slugOf(cells.client)
  if (client === '') refuse('no client')
  if (!clientSlugs.has(client)) refuse(`"${client}" is not on the clients tab`)
  return { item, date, amount, client, description: textOf(cells.description), sheetRow: row.sheetRow }
}
