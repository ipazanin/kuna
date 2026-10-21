import { DEFAULT_SETTINGS } from '../../src/features/settings/domain/settings'
import type { Asset, AssetGroup } from '../../src/features/workbook/domain/assets'
import type { DefinedBucket } from '../../src/features/workbook/domain/bucket'
import type { Grant } from '../../src/features/workbook/domain/grants'
import type { VatTreatment } from '../../src/features/workbook/domain/vatTreatment'
import type { Category, Invoice, OwnerAdvance, Workbook } from '../../src/features/workbook/domain/workbook'
import type { YearEndFigure, YearEndLine, YearEndStatement } from '../../src/features/workbook/domain/yearEnd'
import { withPackBuckets } from './hrDooCategories'
import { civil, euros, ledger } from './ledger'
import type { RowSpec } from './ledger'

// Example Studio d.o.o., registered on 3 March 2025, with synthetic figures. Its first tax period
// runs from March to December 2025, ten months.

function category(slug: string, bucket: DefinedBucket, roles: readonly string[] = [], vat: VatTreatment = 'none'): Category {
  return { slug, family: bucket, bucket, colour: '', roles, vat }
}

export const STUDIO_CATEGORIES: readonly Category[] = [
  category('revenue', 'income', ['revenue']),
  category('grant-income', 'income', ['grant']),
  category('salary-net', 'owner-pay', ['arrears']),
  category('payroll-tax', 'taxes', ['owner-pay-tax', 'arrears']),
  category('rent-owner', 'owner-pay', ['arrears']),
  category('owner-loan-out', 'owner-pay', ['owner-loan-out']),
  category('owner-loan-repaid', 'owner-pay', ['owner-loan-repaid']),
  category('reimbursement-to-owner', 'financing', ['reimbursement']),
  category('dividend', 'owner-pay', ['profit-distribution']),
  category('corporate-income-tax', 'taxes', ['corporate-income-tax']),
  category('vat-refund', 'operating', ['vat-settlement']),
  category('equipment', 'operating', ['capital-purchase'], 'deductible-25'),
  category('software', 'operating', [], 'deductible-25'),
  category('representation', 'operating', ['representation'], 'representation'),
  category('insurance', 'operating', ['prepaid-annual']),
  category('fines', 'operating', ['non-deductible']),
  category('car-costs', 'operating', ['personal-transport'], 'car-50'),
  category('share-capital', 'neutral'),
]

/** Bank rows oldest first. Each comment gives what the accrual view makes of the row. */
export const STUDIO_ROWS: readonly RowSpec[] = [
  { date: '2025-03-05', amount: 2500, category: 'share-capital' },
  // Pays invoice 1-1-25, so it leaves profit and the invoice counts instead.
  { date: '2025-04-10', amount: 5000, category: 'revenue' },
  // March pay, paid in April.
  { date: '2025-04-10', amount: -800, category: 'salary-net' },
  // The laptop: 2,400.00 to the asset books and 600.00 of input VAT.
  { date: '2025-04-15', amount: -3000, category: 'equipment', description: 'Order 1001' },
  // The desk: small inventory of 200.00, written off when put in use.
  { date: '2025-05-10', amount: -250, category: 'equipment', description: 'Order 1002' },
  // 100.00 of cost and 25.00 of input VAT.
  { date: '2025-06-01', amount: -125, category: 'software' },
  { date: '2025-06-15', amount: -50, category: 'fines' },
  // Whole grant on receipt, out of profit. Its release comes in instead.
  { date: '2025-07-01', amount: 10000, category: 'grant-income' },
  // 56.25 of cost after half of the 12.50 VAT.
  { date: '2025-07-20', amount: -62.5, category: 'car-costs' },
  { date: '2025-08-20', amount: 500, category: 'vat-refund' },
  { date: '2025-09-12', amount: -80, category: 'representation' },
  // 365 days of cover from 1 October 2025, 92 of them in 2025.
  { date: '2025-10-01', amount: -365, category: 'insurance' },
  { date: '2025-11-01', amount: -1000, category: 'owner-loan-out' },
  // November pay.
  { date: '2025-12-10', amount: -800, category: 'salary-net' },
  // December pay, its tax and the rent, all paid in January.
  { date: '2026-01-12', amount: -800, category: 'salary-net' },
  { date: '2026-01-12', amount: -100, category: 'payroll-tax' },
  { date: '2026-01-12', amount: -300, category: 'rent-owner' },
  // A small correction a week later, also read as December.
  { date: '2026-01-20', amount: -0.05, category: 'payroll-tax' },
  { date: '2026-02-01', amount: 1000, category: 'owner-loan-repaid' },
  { date: '2026-02-05', amount: -1000, category: 'dividend' },
  { date: '2026-04-30', amount: -899.98, category: 'corporate-income-tax' },
]

export const STUDIO_INVOICES: readonly Invoice[] = [
  invoice('1-1-25', 5000, '2025-03-31', null),
  // 62 days of work from 1 December, so half of it is 2025 revenue.
  invoice('1-1-26', 6200, '2026-01-15', ['2025-12-01', '2026-01-31']),
]

export const STUDIO_GRANT: Grant = {
  slug: 'example-grant',
  received: civil('2025-07-01'),
  amount: euros(10000),
  parts: { fixed: euros(4000), variable: euros(6000) },
  period: { from: civil('2025-03-03'), to: civil('2027-03-02') },
  release: 'fixed-then-assets',
  clawbackFirstYear: 'whole',
  clawbackSecondYear: euros(8000),
  employmentRequiredUntil: civil('2027-03-02'),
  note: '',
  sheetRow: 2,
}

export const STUDIO_ASSETS: readonly Asset[] = [
  // 50% a year from May: 100.00 a month, 800.00 in 2025.
  asset('Example laptop', 2400, '2025-04-15', 'computers', 'Order 1001'),
  asset('Example desk', 200, '2025-05-10', 'other', 'Order 1002'),
]

/** Software the owner paid for privately: 40.00 of cost and 10.00 of input VAT. */
export const STUDIO_ADVANCES: readonly OwnerAdvance[] = [
  { date: civil('2025-06-20'), amount: euros(50), description: 'Software bought privately', category: 'software', family: 'operating', bucket: 'operating', sheetRow: 2 },
]

export function exampleStudio(changes: Partial<Workbook> = {}): Workbook {
  const categories = changes.categories ?? STUDIO_CATEGORIES
  return {
    id: 'example-studio',
    source: 'excel',
    title: 'Example Studio d.o.o.',
    ledgerSheetId: null,
    syncedAt: '2026-10-18T00:00:00.000Z',
    transactions: withPackBuckets(ledger(STUDIO_ROWS), categories),
    categories,
    accounts: [],
    rules: [],
    invoices: STUDIO_INVOICES,
    clients: [],
    hasClientsTab: true,
    billingPlan: [],
    ownerAdvances: STUDIO_ADVANCES,
    privateSharesToMove: [],
    splits: [],
    assets: STUDIO_ASSETS,
    grants: [STUDIO_GRANT],
    yearEndLines: [],
    planLines: [],
    payScenarios: [],
    settings: { ...DEFAULT_SETTINGS, companyFacts: { ...DEFAULT_SETTINGS.companyFacts, companyRegistered: civil('2025-03-03') } },
    problems: [],
    ...changes,
  }
}

let nextSheetRow = 2

export function yearEndLine(
  year: number,
  statement: YearEndStatement,
  line: string,
  figure: number | YearEndFigure,
  categories: readonly string[] = [],
): YearEndLine {
  nextSheetRow += 1
  return {
    year,
    statement,
    line,
    label: line,
    figure: typeof figure === 'number' ? { kind: 'money', amount: euros(figure) } : figure,
    categories,
    aop: '',
    source: 'example-notes.pdf',
    note: '',
    sheetRow: nextSheetRow,
  }
}

function invoice(number: string, amount: number, issued: string, delivered: readonly [string, string] | null): Invoice {
  return {
    number,
    client: 'example-client',
    item: 'Consulting',
    amount: euros(amount),
    issued: civil(issued),
    due: null,
    deliveryPeriod: delivered === null ? null : { from: civil(delivered[0]), to: civil(delivered[1]) },
    sheetRow: 2,
  }
}

function asset(name: string, cost: number, inUse: string, group: AssetGroup, ledgerReference: string): Asset {
  return {
    name,
    bought: civil(inUse),
    inUse: civil(inUse),
    costNet: euros(cost),
    group,
    doubledRate: false,
    disposed: null,
    fundedBy: 'example-grant',
    ledgerReference,
    note: '',
    sheetRow: 2,
  }
}
