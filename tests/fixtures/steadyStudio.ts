import { DEFAULT_SETTINGS } from '../../src/features/settings/domain/settings'
import type { Asset, AssetGroup } from '../../src/features/workbook/domain/assets'
import type { DefinedBucket } from '../../src/features/workbook/domain/bucket'
import type { Grant } from '../../src/features/workbook/domain/grants'
import type { PlanLine } from '../../src/features/workbook/domain/plan'
import type { VatTreatment } from '../../src/features/workbook/domain/vatTreatment'
import type { Category, Invoice, Workbook } from '../../src/features/workbook/domain/workbook'
import type { YearEndLine } from '../../src/features/workbook/domain/yearEnd'
import { exampleStudio, yearEndLine } from './exampleStudio'
import { withPackBuckets } from './hrDooCategories'
import { civil, euros, ledger } from './ledger'
import type { RowSpec } from './ledger'

// Steady Studio d.o.o., registered on 2 January 2025, with synthetic figures. It invoices its one
// client on the last day of each month and is paid on the 20th of the next. Pay and payroll tax
// for a month are paid on the 10th of the next, and a tool costs 120.00 on the 5th of each month.
// The ledger runs from 5 January 2025 to 10 October 2026.

function category(slug: string, bucket: DefinedBucket, roles: readonly string[] = [], vat: VatTreatment = 'none'): Category {
  return { slug, family: bucket, bucket, colour: '', roles, vat }
}

export const STEADY_CATEGORIES: readonly Category[] = [
  category('revenue', 'income', ['revenue']),
  category('grant-income', 'income', ['grant']),
  category('salary-net', 'owner-pay', ['arrears']),
  category('payroll-tax', 'taxes', ['owner-pay-tax', 'arrears']),
  category('ai-services', 'operating'),
  category('consulting', 'operating'),
  category('insurance', 'operating', ['prepaid-annual']),
  category('equipment', 'operating', ['capital-purchase'], 'deductible-25'),
  category('owner-loan-out', 'owner-pay', ['owner-loan-out']),
  category('dividend', 'owner-pay', ['profit-distribution']),
  category('dividend-tax', 'taxes', ['profit-distribution']),
  category('corporate-income-tax', 'taxes', ['corporate-income-tax']),
  category('share-capital', 'neutral'),
]

const CLIENT_IBAN = 'XX00EXAMPLE0000000001'

/** Months from January 2025 to the given month of 2026, as `YYYY-MM`. */
function monthsTo(lastIn2026: number): string[] {
  return Array.from({ length: 12 + lastIn2026 }, (_, offset) => `${2025 + Math.floor(offset / 12)}-${String((offset % 12) + 1).padStart(2, '0')}`)
}

function nextMonth(month: string): string {
  const [year, number] = month.split('-').map(Number) as [number, number]
  return number === 12 ? `${year + 1}-01` : `${year}-${String(number + 1).padStart(2, '0')}`
}

function lastDay(month: string): string {
  const [year, number] = month.split('-').map(Number) as [number, number]
  return `${month}-${String(new Date(Date.UTC(year, number, 0)).getUTCDate()).padStart(2, '0')}`
}

/** 5,000.00 a month to September 2025, 6,000.00 from October 2025. */
function invoiced(month: string): number {
  return month < '2025-10' ? 5000 : 6000
}

/** Every invoice from January 2025 to September 2026. */
export const STEADY_INVOICES: readonly Invoice[] = monthsTo(9).map((month, index) => ({
  number: `${index + 1}-1`,
  client: 'example-client',
  item: 'Design work',
  amount: euros(invoiced(month)),
  issued: civil(lastDay(month)),
  due: null,
  deliveryPeriod: null,
  sheetRow: index + 2,
}))

/** Bank rows oldest first. The September 2026 invoice is paid after the ledger ends. */
export const STEADY_ROWS: readonly RowSpec[] = [
  { date: '2025-01-05', amount: 2500, category: 'share-capital' },
  ...monthsTo(10).flatMap((month): RowSpec[] => [
    { date: `${month}-05`, amount: -120, category: 'ai-services' },
    ...(month === '2025-01' ? [] : [{ date: `${month}-10`, amount: -1000, category: 'salary-net' }, { date: `${month}-10`, amount: -200, category: 'payroll-tax' }]),
  ]),
  ...monthsTo(8).map((month): RowSpec => ({ date: `${nextMonth(month)}-20`, amount: invoiced(month), category: 'revenue', iban: CLIENT_IBAN })),
  // The fixed grant, released in full on receipt.
  { date: '2025-06-01', amount: 1000, category: 'grant-income' },
  { date: '2026-02-05', amount: -5280, category: 'dividend' },
  { date: '2026-02-05', amount: -720, category: 'dividend-tax' },
  { date: '2026-03-01', amount: -3000, category: 'owner-loan-out' },
  // The 2025 balance due, then the advances for April to August.
  { date: '2026-04-28', amount: -1200, category: 'corporate-income-tax' },
  { date: '2026-05-29', amount: -100, category: 'corporate-income-tax' },
  { date: '2026-06-29', amount: -100, category: 'corporate-income-tax' },
  { date: '2026-07-30', amount: -100, category: 'corporate-income-tax' },
  { date: '2026-08-28', amount: -100, category: 'corporate-income-tax' },
  { date: '2026-09-29', amount: -100, category: 'corporate-income-tax' },
  // A laptop of 2,400.00 and 600.00 of input VAT, put in use the same day.
  { date: '2026-07-15', amount: -3000, category: 'equipment', description: 'Order 2001' },
  // A year of cover from 1 September 2026, 1.00 a day.
  { date: '2026-09-01', amount: -365, category: 'insurance' },
].sort((earlier, later) => earlier.date.localeCompare(later.date))

export const STEADY_LAPTOP: Asset = {
  name: 'Laptop',
  bought: civil('2026-07-15'),
  inUse: civil('2026-07-15'),
  costNet: euros(2400),
  group: 'computers',
  doubledRate: false,
  disposed: null,
  fundedBy: '',
  ledgerReference: 'Order 2001',
  note: '',
  sheetRow: 2,
}

/** A fixed grant, so its release falls in 2025 and only its clawback terms reach 2026. */
export const STEADY_GRANT: Grant = {
  slug: 'example-grant',
  received: civil('2025-06-01'),
  amount: euros(1000),
  parts: { fixed: euros(1000), variable: euros(0) },
  period: { from: civil('2025-06-01'), to: civil('2027-05-31') },
  release: 'fixed-then-assets',
  clawbackFirstYear: 'whole',
  clawbackSecondYear: euros(500),
  employmentRequiredUntil: civil('2027-05-31'),
  note: '',
  sheetRow: 2,
}

/** The accountant's 2025 figures as the forecast reads them: the return and the equity carried into 2026. */
export const STEADY_YEAR_END_2025: readonly YearEndLine[] = [
  yearEndLine(2025, 'tax', 'liability', 1200),
  yearEndLine(2025, 'tax', 'months-of-operation', { kind: 'count', count: 12 }),
  yearEndLine(2025, 'tax', 'balance-due', 1200),
  yearEndLine(2025, 'balance', 'share-capital', 2500),
  yearEndLine(2025, 'balance', 'retained-earnings', 0),
  yearEndLine(2025, 'balance', 'profit-of-year', 10800),
]

export function planLine(month: number | null, item: string, amount: number, note = '', year = 2026): PlanLine {
  return { year, month, note, sheetRow: 2, kind: 'amount', item, amount: euros(amount) }
}

export function planPurchase(date: string, amount: number, group: AssetGroup, note = '', sheetRow = 2): PlanLine {
  const day = civil(date)
  return { year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)), note, sheetRow, kind: 'purchase', date: day, amount: euros(amount), group }
}

export function planOwnerPay(year: number, scenario: string, from: string | null = null, sheetRow = 2): PlanLine {
  return { year, month: null, note: '', sheetRow, kind: 'owner-pay-scenario', scenario, from: from === null ? null : civil(from) }
}

export function steadyStudio(changes: Partial<Workbook> = {}): Workbook {
  const categories = changes.categories ?? STEADY_CATEGORIES
  return exampleStudio({
    title: 'Steady Studio d.o.o.',
    categories,
    transactions: withPackBuckets(ledger(STEADY_ROWS), categories),
    invoices: STEADY_INVOICES,
    clients: [{ slug: 'example-client', name: 'Example client', ibans: [CLIENT_IBAN] }],
    ownerAdvances: [],
    assets: [STEADY_LAPTOP],
    grants: [STEADY_GRANT],
    yearEndLines: STEADY_YEAR_END_2025,
    settings: { ...DEFAULT_SETTINGS, companyFacts: { ...DEFAULT_SETTINGS.companyFacts, companyRegistered: civil('2025-01-02') } },
    ...changes,
  })
}
