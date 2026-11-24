import type { BillingItem } from '../../workbook/domain/billingPlan'

/** Every item the billing plan names, once each in plan order, or only those of one client's rows when `client` is given. */
export function planItemsOf(plan: readonly BillingItem[], client?: string): string[] {
  const rows = client === undefined ? plan : plan.filter((row) => row.client === client)
  return [...new Set(rows.map((row) => row.item))]
}
