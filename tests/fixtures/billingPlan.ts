import type { BillingItem } from '../../src/features/workbook/domain/billingPlan'
import type { Invoice } from '../../src/features/workbook/domain/workbook'
import { civil, euros } from './ledger'

let nextSheetRow = 2

/** A row of the `outgoing-plan` tab, numbered in the order the spec writes it. */
export function planRow(item: string, date: string, amount: number, client = 'north', description = ''): BillingItem {
  nextSheetRow += 1
  return { item, date: civil(date), amount: euros(amount), client, description, sheetRow: nextSheetRow }
}

export function invoiceOf(number: string, amount: number, issued: string, client = 'north'): Invoice {
  nextSheetRow += 1
  return { number, client, item: 'Software development', amount: euros(amount), issued: civil(issued), due: null, deliveryPeriod: null, sheetRow: nextSheetRow }
}
