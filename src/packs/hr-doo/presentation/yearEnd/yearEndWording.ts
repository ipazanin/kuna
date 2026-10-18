import type { AdjustmentId } from '../../domain/accrual/accrualAdjustment'
import type { LineStatus } from '../../domain/yearEnd/yearEndComparison'
import type { OpenItemGroup } from '../../domain/yearEnd/yearEndOpenItems'

/** What each year-end line is called on screen. The accountant's printed label shows beside it. */
export const LINE_LABELS: Readonly<Record<string, string>> = {
  'pl:sales': 'Sales',
  'pl:own-use': 'Own use',
  'pl:other-operating-income': 'Other operating income',
  'pl:financial-income': 'Financial income',
  'pl:material-costs': 'Material costs',
  'pl:personnel-costs': 'Personnel costs',
  'pl:depreciation': 'Depreciation',
  'pl:other-costs': 'Other costs',
  'pl:impairment-provisions-other': 'Impairment, provisions and other expenses',
  'pl:financial-expenses': 'Financial expenses',
  'pl:profit-before-tax': 'Profit before tax',
  'pl:corporate-income-tax': 'Corporate income tax',
  'pl:profit-after-tax': 'Profit after tax',
  'grant:released-in-year': 'Grant released in the year',
  'grant:deferred-at-year-end': 'Grant deferred at the year end',
  'balance:intangible-assets': 'Intangible assets',
  'balance:tangible-assets': 'Tangible assets',
  'balance:financial-assets': 'Financial assets',
  'balance:inventories': 'Inventories',
  'balance:receivables-trade': 'Owed by clients',
  'balance:receivables-members-employees': 'Owed by the owner and employees',
  'balance:receivables-state': 'Owed by the state',
  'balance:receivables-other': 'Other receivables',
  'balance:cash': 'Cash',
  'balance:prepaid-accrued-income': 'Paid ahead and earned, not invoiced',
  'balance:total-assets': 'Total assets',
  'balance:share-capital': 'Share capital',
  'balance:reserves': 'Reserves',
  'balance:retained-earnings': 'Retained earnings',
  'balance:profit-of-year': 'Profit of the year',
  'balance:provisions': 'Provisions',
  'balance:long-term-liabilities': 'Long-term liabilities',
  'balance:payables-suppliers': 'Owed to suppliers',
  'balance:payables-employees': 'Owed to the owner and employees',
  'balance:payables-taxes': 'Taxes and contributions owed',
  'balance:payables-loans': 'Loans owed',
  'balance:accruals-deferred-income': 'Accruals and deferred income',
  'tax:revenue': 'Revenue, line 1',
  'tax:expenses': 'Expenses, line 2',
  'tax:increases': 'Increases, line 26',
  'tax:decreases': 'Decreases, line 35',
  'tax:tax-base': 'Tax base, line 38',
  'tax:rate': 'Rate, line 43',
  'tax:liability': 'Tax, line 53',
  'tax:advances-paid': 'Advances paid, line 56',
  'tax:balance-due': 'Balance due, line 57',
  'tax:refund': 'Refund, line 58',
  'tax:monthly-advance': 'Monthly advance, line 59',
  'tax:months-of-operation': 'Months of the tax period',
  'tax:filed-on': 'Return filed on',
  'tax:paid-on': 'Balance paid on',
  'distribution:retained': 'Profit kept',
  'distribution:dividend': 'Profit paid out',
  'distribution:reserves': 'Profit put to reserves',
  'distribution:decided-on': 'Decided on',
}

export function lineLabel(statement: string, line: string): string {
  return LINE_LABELS[`${statement}:${line}`] ?? line
}

/** Short names for the bridge's bars and the "explained by" lists. The adjustment's own label says the rest. */
export const ADJUSTMENT_LABELS: Readonly<Record<AdjustmentId, string>> = {
  'revenue-by-delivery': 'Revenue by delivery',
  'owner-loans': 'Owner loans',
  'grant-receipts': 'Grant received',
  'grant-release': 'Grant released',
  'grant-schedule': 'Accountant’s grant release',
  'profit-distributions': 'Profit paid out',
  'corporate-tax-paid': 'Corporate tax paid',
  'vat-settlements': 'VAT settled',
  'input-vat': 'Input VAT',
  'capital-purchases': 'Capital purchases',
  depreciation: 'Depreciation',
  'asset-write-offs': 'Write-offs',
  'arrears-reversed': 'Arrears from last year',
  'arrears-accrued': 'Arrears into next year',
  'arrears-cut-off': 'Arrears cut-off',
  'prepaid-spread': 'Paid ahead, spread',
  'representation-as-booked': 'Representation as booked',
  'corporate-income-tax': 'Corporate tax',
  'cost-placement': 'Accountant’s cost lines',
  'liability-placement': 'Accountant’s liability lines',
  'receivable-placement': 'Accountant’s receivable lines',
  'unexplained-before-tax': 'Not explained',
  'unexplained-after-tax': 'Not explained',
}

export interface StatusWording {
  readonly label: string
  readonly icon: string
  readonly color: 'success' | 'info' | 'warning' | 'error' | 'neutral'
  readonly meaning: string
}

export const STATUS_WORDING: Readonly<Record<LineStatus, StatusWording>> = {
  matched: { label: 'Matched', icon: 'i-lucide-circle-check', color: 'success', meaning: 'Agrees with the accountant’s own figure.' },
  explained: { label: 'Explained', icon: 'i-lucide-route', color: 'info', meaning: 'Follows from the workbook and the rules, through the adjustments listed.' },
  judgement: {
    label: 'Judgement',
    icon: 'i-lucide-scale',
    color: 'warning',
    meaning: 'Takes the accountant’s figure for a choice the ledger cannot show.',
  },
  open: { label: 'Open', icon: 'i-lucide-circle-alert', color: 'error', meaning: 'Leaves a difference nothing explains.' },
}

export const STATUSES: readonly LineStatus[] = ['matched', 'explained', 'judgement', 'open']

export const GROUP_WORDING: Readonly<Record<OpenItemGroup, { readonly title: string; readonly description: string }>> = {
  unexplained: { title: 'Not explained', description: 'A gap to the accountant’s profit that no adjustment accounts for.' },
  judgement: { title: 'The accountant’s choices', description: 'Figures taken from the accountant where the ledger cannot show the choice.' },
  completeness: { title: 'Is anything missing?', description: 'Work, purchases or rows the workbook may not hold yet.' },
  compliance: { title: 'Compliance', description: 'What the year’s loans and purchases call for beyond the figures.' },
}
