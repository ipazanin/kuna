import type { BucketTone } from '../../../shared/charts/chartTokens'

export interface SampleTransaction {
  readonly id: string
  readonly date: string
  readonly month: string
  readonly counterparty: string
  readonly category: string
  readonly bucket: BucketTone
  readonly account: string
  readonly amountCents: number
}

/** Invented rows with invented counterparties. They only exist to show the table's look. */
export const SAMPLE_TRANSACTIONS: readonly SampleTransaction[] = [
  { id: 't01', date: '2026-10-14', month: 'October 2026', counterparty: 'Northwind Analytics', category: 'revenue', bucket: 'income', account: 'Main', amountCents: 610000 },
  { id: 't02', date: '2026-10-09', month: 'October 2026', counterparty: 'Cloud hosting', category: 'software-subscriptions', bucket: 'operating', account: 'Card', amountCents: -4890 },
  { id: 't03', date: '2026-10-05', month: 'October 2026', counterparty: 'Tax office', category: 'payroll-contributions', bucket: 'taxes', account: 'Main', amountCents: -95000 },
  { id: 't04', date: '2026-10-01', month: 'October 2026', counterparty: 'Owner', category: 'salary-net', bucket: 'owner-pay', account: 'Main', amountCents: -200000 },
  { id: 't05', date: '2026-09-29', month: 'September 2026', counterparty: 'Contoso Studio', category: 'revenue', bucket: 'income', account: 'Main', amountCents: 820000 },
  { id: 't06', date: '2026-09-22', month: 'September 2026', counterparty: 'Bookkeeping office', category: 'accounting', bucket: 'operating', account: 'Main', amountCents: -40000 },
  { id: 't07', date: '2026-09-18', month: 'September 2026', counterparty: 'Airline', category: 'travel', bucket: 'operating', account: 'Card', amountCents: -31240 },
  { id: 't08', date: '2026-09-15', month: 'September 2026', counterparty: 'Northwind Analytics', category: 'revenue', bucket: 'income', account: 'Main', amountCents: 600000 },
  { id: 't09', date: '2026-09-10', month: 'September 2026', counterparty: 'Savings', category: 'internal-transfer', bucket: 'neutral', account: 'Savings', amountCents: 150000 },
  { id: 't10', date: '2026-09-05', month: 'September 2026', counterparty: 'Tax office', category: 'payroll-tax', bucket: 'taxes', account: 'Main', amountCents: -119000 },
  { id: 't11', date: '2026-09-01', month: 'September 2026', counterparty: 'Owner', category: 'salary-net', bucket: 'owner-pay', account: 'Main', amountCents: -280000 },
  { id: 't12', date: '2026-08-28', month: 'August 2026', counterparty: 'Mobile operator', category: 'telecom', bucket: 'operating', account: 'Card', amountCents: -2999 },
]
