import type { BillingItem } from '../domain/billingPlan'
import { inTabOrder, isUnreadable, positiveMoney, readRow, refuse, requiredDate, slugOf, textOf } from './cellReading'
import type { RowProblem, TabReading } from './cellReading'
import type { SheetRow } from './workbookSnapshot'

/** The columns the app reads and writes. Anything else on the tab is the Sheet's own. */
export const BILLING_PLAN_COLUMNS = ['item', 'date', 'amount', 'client', 'description'] as const

/**
 * The `outgoing-plan` tab. Only its five columns are read, and a row with nothing in them is skipped
 * without a problem, because a Sheet may keep its own formulas beside the rows. A client the clients
 * tab does not name leaves the row out.
 */
export function readBillingPlan(rows: readonly SheetRow[], clientSlugs: ReadonlySet<string>): TabReading<BillingItem> {
  const facts: BillingItem[] = []
  const problems: RowProblem[] = []
  for (const row of inTabOrder(rows)) {
    if (BILLING_PLAN_COLUMNS.every((column) => row.cells[column] === undefined)) {
      continue
    }
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
