import type { BillingItem } from '../../src/apps/company/workbook/domain/billingPlan'
import { BILLING_RECORDS, INVOICE_RECORDS } from '../../src/apps/company/workbook/domain/coreKinds'
import type { Invoice } from '../../src/apps/company/workbook/domain/workbook'
import { civil, euros } from './ledger'
import { recordIdOf } from '../../src/shared/storage/domain/recordId'

let nextRow = 2

/** A row of the `outgoing-plan` tab, its id numbered in the order the spec writes it. */
export function planRow(item: string, date: string, amount: number, client = 'north', description = ''): BillingItem {
  nextRow += 1
  return { item, date: civil(date), amount: euros(amount), client, description, id: recordIdOf(BILLING_RECORDS, `row-${nextRow}`) }
}

export function invoiceOf(number: string, amount: number, issued: string, client = 'north'): Invoice {
  nextRow += 1
  return { number, client, item: 'Software development', amount: euros(amount), issued: civil(issued), due: null, deliveryPeriod: null, id: recordIdOf(INVOICE_RECORDS, `row-${nextRow}`) }
}
