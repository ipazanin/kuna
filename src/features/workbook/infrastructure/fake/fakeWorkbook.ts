import { RULE_COLUMNS } from '../../../rules/domain/rule'
import type { WorkbookSource } from '../../domain/workbook'
import type { CellValue, WorkbookSnapshot, WorkbookTab } from '../workbookSnapshot'
import { sheetRowsFromValues } from '../workbookSnapshot'

/**
 * A synthetic workbook for fake mode and tests. Every name, IBAN and amount is made up. It spans
 * eighteen months from a part-month opening to a part-month at the end, on two accounts, one of
 * which closes with a transfer to the other, and it holds one loss month.
 *
 * The id doubles as the marker `assert-no-fake-bytes` looks for in a production bundle.
 */
export const FAKE_SPREADSHEET_ID = 'FAKE-WORKBOOK-ONLY-DO-NOT-SHIP'

export const FAKE_WORKBOOK_TITLE = 'Fake workbook'

/** The `roles` column as the shadow-accounting Sheet seeds it. Salary and rent are paid in the month after the work, hence `arrears`. */
const CATEGORY_ROLES: Readonly<Record<string, string>> = {
  revenue: 'revenue',
  'grant-income': 'grant',
  'client-refund': 'client-refund',
  'payroll-contributions': 'watched, owner-pay-tax, arrears',
  'payroll-tax': 'owner-pay-tax, arrears',
  'corporate-income-tax': 'corporate-income-tax',
  'dividend-tax': 'owner-pay-tax, profit-distribution',
  'salary-net': 'arrears',
  dividend: 'profit-distribution',
  'rent-owner': 'watched, arrears',
  accounting: 'watched',
  equipment: 'capital-purchase',
  representation: 'representation',
  'health-insurance': 'prepaid-annual',
  'vat-refund': 'vat-settlement',
  'owner-loan-out': 'owner-loan-out',
  'owner-loan-repaid': 'owner-loan-repaid',
  'reimbursement-to-owner': 'reimbursement',
  'reimbursement-from-owner': 'reimbursement',
}

/** The `vat` column. Foreign tools invoice without VAT under the reverse charge. Blank is none. */
const CATEGORY_VAT: Readonly<Record<string, string>> = {
  equipment: 'deductible-25',
  'external-contractors': 'deductible-25',
  consulting: 'deductible-25',
  accounting: 'deductible-25',
  'ai-services': 'reverse-charge',
  'software-subscriptions': 'reverse-charge',
  'office-supplies': 'deductible-25',
  representation: 'representation',
  telecom: 'deductible-25',
}

/** The categories seed of the shadow-accounting Sheet, as its `categories` tab starts out. */
const CATEGORY_SEED: readonly { readonly family: string; readonly colour: string; readonly categories: readonly (readonly [string, string])[] }[] = [
  {
    family: 'income',
    colour: '#d7f0e5',
    categories: [
      ['revenue', 'income'],
      ['grant-income', 'income'],
      ['tax-refund', 'taxes'],
      ['client-refund', 'income'],
      ['bank-interest', 'income'],
    ],
  },
  {
    family: 'taxes',
    colour: '#f9dcdc',
    categories: [
      ['payroll-contributions', 'taxes'],
      ['payroll-tax', 'taxes'],
      ['corporate-income-tax', 'taxes'],
      ['dividend-tax', 'taxes'],
    ],
  },
  {
    family: 'owner',
    colour: '#e4e1f6',
    categories: [
      ['salary-net', 'owner-pay'],
      ['salary-bonus', 'owner-pay'],
      ['dividend', 'owner-pay'],
      ['rent-owner', 'owner-pay'],
      ['owner-loan-out', 'owner-pay'],
      ['owner-loan-repaid', 'owner-pay'],
      ['reimbursement-to-owner', 'financing'],
      ['reimbursement-from-owner', 'financing'],
    ],
  },
  {
    family: 'operating',
    colour: '#dce9f9',
    categories: [
      ['equipment', 'operating'],
      ['external-contractors', 'operating'],
      ['consulting', 'operating'],
      ['accounting', 'operating'],
      ['travel', 'operating'],
      ['ai-services', 'operating'],
      ['software-subscriptions', 'operating'],
      ['office-supplies', 'operating'],
      ['representation', 'operating'],
      ['telecom', 'operating'],
      ['bank-fees', 'operating'],
      ['health-insurance', 'operating'],
      ['vat-refund', 'operating'],
    ],
  },
  {
    family: 'neutral',
    colour: '#ececec',
    categories: [
      ['internal-transfer', 'neutral'],
      ['share-capital', 'neutral'],
    ],
  },
]

const ACCOUNTS = {
  legacy: 'XX00FAKE0000000000000001',
  main: 'XX00FAKE0000000000000002',
} as const

type AccountSlug = keyof typeof ACCOUNTS

/** The old account carries everything until the new one opens, then is swept to it and closed. */
const MAIN_OPENS = '2026-01-03'
const LEGACY_CLOSES = '2026-03-02'

const PAYEES = {
  client: { name: 'Northwind Analytics Ltd', iban: 'XX00FAKE0000000000000010' },
  secondClient: { name: 'Lumen Labs GmbH', iban: 'XX00FAKE0000000000000012' },
  unknownPayer: { name: 'J. Doe Consulting', iban: 'XX00FAKE0000000000000090' },
  owner: { name: 'Alex Example', iban: 'XX00FAKE0000000000000020' },
  pension: { name: 'PENSION FUND', iban: 'XX00FAKE0000000000000030' },
  health: { name: 'HEALTH INSURANCE FUND', iban: 'XX00FAKE0000000000000031' },
  taxOffice: { name: 'City Tax Office', iban: 'XX00FAKE0000000000000032' },
  stateBudget: { name: 'STATE BUDGET', iban: 'XX00FAKE0000000000000033' },
  accountant: { name: 'Brightdesk Accounting', iban: 'XX00FAKE0000000000000040' },
  bank: { name: 'EXAMPLE BANK', iban: 'XX00FAKE0000000000000050' },
  contractor: { name: 'Pixel Studio', iban: 'XX00FAKE0000000000000060' },
  insurer: { name: 'Steady Health Plans', iban: 'XX00FAKE0000000000000070' },
  grantor: { name: 'Regional Development Agency', iban: 'XX00FAKE0000000000000080' },
} as const

interface FakeInvoice {
  readonly number: string
  readonly client: string
  readonly item: string
  readonly amount: number
  readonly issued: string
  /** Blank on an invoice that gave no due date. */
  readonly due: string
  /** The month the work was done, `YYYY-MM`, or blank when the invoice leaves its delivery period out. */
  readonly workedIn: string
}

interface Booking {
  readonly date: string
  readonly account?: AccountSlug
  readonly counterparty: string
  readonly iban: string
  readonly description: string
  readonly amount: number
  readonly category: string
  readonly flaggedBy: string
}

const MONTHS = [
  '2025-05', '2025-06', '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01',
  '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10',
] as const

/** The month with no client payment and a large purchase, so its net is negative. */
const LOSS_MONTH = '2025-11'

/**
 * As a Google Sheet its `settings` tab holds the row the Apps Script requires and the invoice
 * details, so every other default applies. As a workbook kept in this browser it also names its
 * company, the way a template user would.
 * Rows the rules tab does not reproduce are flagged as a person's, so Review has coverage gaps to show.
 */
export function fakeWorkbookSnapshot(syncedAt: string, source: WorkbookSource = 'google'): WorkbookSnapshot {
  const values = fakeWorkbookValues(source)
  return {
    meta: {
      id: FAKE_SPREADSHEET_ID,
      source,
      title: FAKE_WORKBOOK_TITLE,
      syncedAt,
      ledgerSheetId: source === 'google' ? 0 : null,
      lastExportedAt: null,
      unexportedSince: null,
      missingTabs: [],
    },
    ledger: sheetRowsFromValues(values.ledger),
    categories: sheetRowsFromValues(values.categories),
    accounts: sheetRowsFromValues(values.accounts),
    settings: sheetRowsFromValues(values.settings),
    rules: sheetRowsFromValues(values.rules),
    invoices: sheetRowsFromValues(values.invoices),
    clients: sheetRowsFromValues(values.clients),
    'outgoing-plan': sheetRowsFromValues(values['outgoing-plan']),
    'owner-advances': sheetRowsFromValues(values['owner-advances']),
    assets: sheetRowsFromValues(values.assets),
    grants: sheetRowsFromValues(values.grants),
    'year-end': sheetRowsFromValues(values['year-end']),
    plan: sheetRowsFromValues(values.plan),
    scenarios: sheetRowsFromValues(values.scenarios),
    splits: sheetRowsFromValues(values.splits),
  }
}

/** What the made-up company's invoices print. The invoice folder is left to pick, as on a first run. */
const FAKE_INVOICING: CellValue[][] = [
  ['invoice_company_name', 'Example Studio d.o.o.'],
  ['invoice_address', 'Primjerna ulica 12, Đakovo'],
  ['invoice_country', 'Croatia'],
  ['invoice_vat_id', 'HR00000000000'],
  ['invoice_phone', '+385 1 000 0000'],
  ['invoice_mail', 'billing@example.com'],
  ['invoice_iban', 'HR6212345670000000001'],
  ['invoice_swift', 'EXMPHR22'],
  ['invoice_bank', 'Example Bank d.d.'],
  ['invoice_court_register', '000000000'],
  ['invoice_share_capital', 'EUR 2,500.00 (fully paid-up)'],
  ['invoice_place', 'Đakovo'],
  ['invoice_issue_time', '17:00h'],
  ['invoice_signatory', 'Alex Čolić'],
  ['invoice_signatory_title', 'director'],
]

/** The tabs as the Sheets API returns them: header row first, dates as serial numbers. */
export function fakeWorkbookValues(source: WorkbookSource = 'google'): Record<WorkbookTab, CellValue[][]> {
  const { bookings, invoices } = fakeBooks()
  const ledger = ledgerValues(bookings)
  return {
    settings:
      source === 'google'
        ? [['key', 'value'], ['card_settlement_ibans', ''], ...FAKE_INVOICING]
        : [
            ['key', 'value'],
            ['template_version', 1],
            ['company_name', 'Example Studio'],
            ['currency', 'EUR'],
            ['hr_residence_city', 'Zagreb'],
            ['hr_birth_year', 1990],
            ['hr_pension_pillar_2', true],
            ['hr_company_registered', '2025-05-12'],
            ['billing_monthly_amount', 7200],
            ['billing_monthly_item', 'Monthly Fee'],
            ['billing_subscription_amount', 60],
            ['billing_subscription_item', 'Subscription'],
            ['billing_bonus_amount', 4800],
            ['billing_bonus_item', 'Bonus'],
            ['billing_client', 'northwind'],
            ...FAKE_INVOICING,
          ],
    ledger,
    categories: [
      ['category', 'family', 'bucket', 'colour', 'roles', 'vat'],
      ...CATEGORY_SEED.flatMap((group) =>
        group.categories.map(([category, bucket]) => [category, group.family, bucket, group.colour, CATEGORY_ROLES[category] ?? '', CATEGORY_VAT[category] ?? '']),
      ),
    ],
    accounts: [['account', 'iban'], ...Object.entries(ACCOUNTS).map(([account, iban]) => [account, iban])],
    rules: rulesValues(),
    invoices: [
      ['number', 'client', 'item', 'amount', 'issued', 'due', 'period_from', 'period_to'],
      ...invoices.map((invoice) => [
        invoice.number,
        invoice.client,
        invoice.item,
        invoice.amount,
        serialOf(invoice.issued),
        invoice.due === '' ? '' : serialOf(invoice.due),
        invoice.workedIn === '' ? '' : serialOf(`${invoice.workedIn}-01`),
        invoice.workedIn === '' ? '' : serialOf(lastDayOf(invoice.workedIn)),
      ]),
    ],
    clients: [
      ['client', 'name', 'iban', 'address', 'country', 'tax_id', 'invoice_mail', 'mail_language', 'reverse_charge'],
      ['northwind', 'Northwind Analytics', PAYEES.client.iban, '1 Example Road, London', 'United Kingdom', 'GB000000000', 'accounts@northwind.example', 'en', true],
      ['lumen', 'Lumen Labs', PAYEES.secondClient.iban],
    ],
    'outgoing-plan': billingPlanValues(invoices),
    'owner-advances': [
      ['date', 'amount', 'description', 'category'],
      [serialOf('2026-02-03'), 212.5, 'Train tickets to the client, paid privately', 'travel'],
      [serialOf('2026-08-21'), 89, 'Design tool, annual plan on the owner’s card', 'software-subscriptions'],
      [serialOf('2026-09-30'), 34.2, 'Printer paper', 'office-supplies'],
      [serialOf('2025-10-02'), -9.71, 'Private share of the paper and ink order', 'office-supplies'],
    ],
    splits: splitsValues(ledger),
    ...planningValues(),
  }
}

/**
 * The tabs the year-end and planning screens read, for "Example Studio d.o.o.": the two computers
 * the ledger bought, the start-up grant it received, the accountant's 2025 figures, a 2026 plan row
 * the ledger's months compare with, a 2027 plan whose owner pay switches from the floor salary to
 * board-only insurance the day after the grant's employment date, with a purchase and a dividend,
 * and four owner pay scenarios for 2027, two of them with warnings to show. The accountant's 2025 figures are made up to agree with the accrual view of
 * the ledger, except where the Year end screen needs something to show: the grant released, rent
 * placed on other costs, bank interest as financial income and 10.00 moved between two konto lines.
 */
function planningValues(): Pick<Record<WorkbookTab, CellValue[][]>, 'assets' | 'grants' | 'year-end' | 'plan' | 'scenarios'> {
  const yearEnd = (statement: string, line: string, label: string, amount: number, categories = ''): CellValue[] => [
    2025,
    statement,
    line,
    label,
    amount,
    categories,
    '',
    'example-studio-2025-package.pdf',
    '',
  ]
  return {
    assets: [
      ['asset', 'bought', 'in_use', 'cost_net', 'group', 'doubled', 'disposed', 'funded_by', 'ledger_reference', 'note'],
      ['Laptop 14 inch', serialOf('2025-05-28'), serialOf('2025-06-01'), 1519.2, 'computers', '', '', '', 'Card purchase, laptop', ''],
      ['Workstation', serialOf('2025-11-21'), serialOf('2025-11-24'), 2720, 'computers', '', '', 'startup-grant', 'Card purchase, workstation', 'Paid from the grant'],
    ],
    grants: [
      [
        'grant',
        'received',
        'amount',
        'fixed_part',
        'variable_part',
        'period_from',
        'period_to',
        'release',
        'clawback_year1',
        'clawback_year2',
        'employment_required_until',
        'note',
      ],
      [
        'startup-grant',
        serialOf('2025-09-15'),
        5000,
        2000,
        3000,
        serialOf('2025-09-15'),
        serialOf('2027-09-14'),
        'fixed-then-assets',
        'whole',
        2500,
        serialOf('2027-09-14'),
        'Regional start-up grant',
      ],
    ],
    'year-end': [
      ['year', 'statement', 'line', 'label', 'amount', 'categories', 'aop', 'source', 'note'],
      yearEnd('pl', 'sales', 'Prihodi od prodaje', 57147.33),
      yearEnd('pl', 'other-operating-income', 'Ostali poslovni prihodi', 2050),
      yearEnd('pl', 'financial-income', 'Financijski prihodi', 0.04),
      yearEnd('pl', 'material-costs', 'Materijalni troškovi', 6242.17),
      yearEnd('pl', 'personnel-costs', 'Troškovi osoblja', 14233.6),
      yearEnd('pl', 'depreciation', 'Amortizacija', 493.13),
      yearEnd('pl', 'other-costs', 'Ostali troškovi', 2463.79),
      yearEnd('pl', 'profit-before-tax', 'Dobit prije oporezivanja', 35764.68),
      yearEnd('pl', 'corporate-income-tax', 'Porez na dobit', 3579.97),
      yearEnd('pl', 'profit-after-tax', 'Dobit razdoblja', 32184.71),
      yearEnd('balance', 'tangible-assets', 'Dugotrajna materijalna imovina', 3746.07),
      yearEnd('balance', 'receivables-trade', 'Potraživanja od kupaca', 14426.47),
      yearEnd('balance', 'receivables-members-employees', 'Potraživanja od zaposlenika i članova poduzetnika', 3009.71),
      yearEnd('balance', 'receivables-state', 'Potraživanja od države', 2400.63),
      yearEnd('balance', 'cash', 'Novac u banci i blagajni', 19367.67),
      yearEnd('balance', 'prepaid-accrued-income', 'Plaćeni troškovi budućeg razdoblja', 218.33),
      yearEnd('balance', 'total-assets', 'Ukupno aktiva', 43168.88),
      yearEnd('balance', 'share-capital', 'Temeljni kapital', 2500),
      yearEnd('balance', 'retained-earnings', 'Zadržana dobit', 0),
      yearEnd('balance', 'profit-of-year', 'Dobit poslovne godine', 32184.71),
      yearEnd('balance', 'payables-employees', 'Obveze prema zaposlenicima', 1400),
      yearEnd('balance', 'payables-taxes', 'Obveze za poreze i doprinose', 4134.17),
      yearEnd('balance', 'accruals-deferred-income', 'Prihod budućeg razdoblja', 2950),
      yearEnd('tax', 'revenue', 'Prihodi', 59197.37),
      yearEnd('tax', 'expenses', 'Rashodi', 23432.69),
      yearEnd('tax', 'increases', 'Povećanja', 35),
      yearEnd('tax', 'tax-base', 'Porezna osnovica', 35799.68),
      yearEnd('tax', 'rate', 'Porezna stopa', 0.1),
      yearEnd('tax', 'liability', 'Porezna obveza', 3579.97),
      yearEnd('tax', 'advances-paid', 'Plaćeni predujmovi', 0),
      yearEnd('tax', 'balance-due', 'Razlika za uplatu', 3579.97),
      yearEnd('tax', 'monthly-advance', 'Mjesečni predujam', 447.5),
      yearEnd('tax', 'months-of-operation', 'Broj mjeseci', 8),
      yearEnd('tax', 'filed-on', 'Predano', serialOf('2026-04-27')),
      yearEnd('tax', 'paid-on', 'Plaćeno', serialOf('2026-04-28')),
      yearEnd('distribution', 'retained', 'Zadržana dobit', 27784.71),
      yearEnd('distribution', 'dividend', 'Isplata dobiti', 4400),
      yearEnd('distribution', 'decided-on', 'Odluka o raspodjeli dobiti', serialOf('2026-05-15')),
      yearEnd('grant', 'released-in-year', 'Prihod od potpore', 2050),
      yearEnd('grant', 'deferred-at-year-end', 'Odgođeni prihod od potpore', 2950),
      yearEnd('konto', '41200', 'Usluge telefona', 82.04, 'telecom'),
      yearEnd('konto', '41810', 'Računovodstvene usluge', 1200, 'accounting'),
      yearEnd('konto', '41850', 'Softver i pretplate', 435.87, 'ai-services, software-subscriptions'),
      yearEnd('konto', '46500', 'Reprezentacija', 70, 'representation'),
    ],
    plan: [
      ['year', 'month', 'item', 'amount', 'note', 'date', 'group'],
      [2026, '', 'ai-services', 55, 'Model API seats', '', ''],
      [2026, '', 'purchase', 420, 'Second monitor', serialOf('2026-11-12'), 'equipment'],
      [2027, '', 'software-subscriptions', 10, '', '', ''],
      [2027, 1, 'software-subscriptions', 120, 'Yearly design tool', '', ''],
      [2027, '', 'owner_pay_scenario', 'floor-salary', '', '', ''],
      [2027, '', 'owner_pay_scenario', 'floor-then-board', '', serialOf('2027-09-15'), ''],
      [2027, '', 'purchase', 1600, 'Replacement laptop', serialOf('2027-03-10'), 'computers'],
      [2027, 6, 'dividend', 8000, 'After the 2026 statements are adopted', '', ''],
    ],
    scenarios: [
      ['scenario', 'label', 'year', 'component', 'amount', 'from', 'to'],
      ['floor-salary', 'Floor salary all year', 2027, 'salary_gross', 'floor', '', ''],
      ['floor-salary', '', 2027, 'dividend', 'max', '', ''],
      ['floor-extras', 'Floor salary, tax-free items and rent', 2027, 'salary_gross', 'floor', '', ''],
      ['floor-extras', '', 2027, 'nontaxable:results-bonus', 1200, '', ''],
      ['floor-extras', '', 2027, 'nontaxable:occasional-gift', 900, serialOf('2027-12-01'), ''],
      ['floor-extras', '', 2027, 'rent_monthly', 350, '', ''],
      ['floor-extras', '', 2027, 'dividend', 'max', '', ''],
      ['floor-then-board', 'Floor salary, then board member only', 2027, 'salary_gross', 'floor', '', serialOf('2027-09-14')],
      ['floor-then-board', '', 2027, 'director_basis', 'board-only', serialOf('2027-09-15'), ''],
      ['floor-then-board', '', 2027, 'dividend', 'max', '', ''],
      ['early-exit', 'Salary stops in June, large payout', 2027, 'salary_gross', 2000, '', serialOf('2027-06-30')],
      ['early-exit', '', 2027, 'director_basis', 'insured-elsewhere', serialOf('2027-07-01'), ''],
      ['early-exit', '', 2027, 'dividend', 120000, '', ''],
    ],
  }
}

interface FakeSplit {
  readonly date: string
  readonly counterparty: string
  readonly description: string
  readonly parts: readonly (readonly [category: string, amount: number | null, note: string])[]
}

/**
 * Three ledger rows split into parts, each found by its day, counterparty and description: a June salary paid
 * with a results bonus, a design invoice that also paid a workshop, and a business lunch with the
 * owner's own share in it. The last part of each takes a fixed amount and the first the rest.
 */
const SPLIT_ROWS: readonly FakeSplit[] = [
  { date: '2026-07-12', counterparty: PAYEES.owner.name, description: 'Salary for 2026-06', parts: [['salary-net', null, 'Net salary'], ['salary-bonus', 200, 'Results bonus paid with the salary']] },
  { date: '2026-03-16', counterparty: PAYEES.contractor.name, description: 'Design work', parts: [['external-contractors', null, 'Design work'], ['consulting', 400, 'Workshop facilitation']] },
  { date: '2026-05-10', counterparty: 'BISTRO HARBOUR · business lunch', description: 'Card purchase', parts: [['representation', null, 'Client lunch'], ['owner-loan-out', 25, 'The owner’s own lunch']] },
]

function splitsValues(ledger: readonly (readonly CellValue[])[]): CellValue[][] {
  const [header = [], ...rows] = ledger
  const column = (name: string): number => header.indexOf(name)
  return [
    ['date', 'account', 'row_amount', 'row_balance', 'amount', 'category', 'note'],
    ...SPLIT_ROWS.flatMap((split) => {
      const row = rows.find(
        (cells) => cells[column('date')] === serialOf(split.date) && cells[column('counterparty')] === split.counterparty && cells[column('description')] === split.description,
      )
      if (row === undefined) {
        throw new Error(`The fake ledger has no row "${split.description}" on ${split.date} to split.`)
      }
      const amount = Number(row[column('amount')])
      const fixed = split.parts.reduce((sum, [, part]) => sum + (part ?? 0), 0)
      return split.parts.map(([category, part, note]) => [
        row[column('date')]!,
        row[column('account')]!,
        amount,
        row[column('balance')]!,
        part === null ? roundToCent(amount + fixed) : -part,
        category,
        note,
      ])
    }),
  ]
}

/** Re-billed costs and extras of a worked month, which its invoice carries beside the fee. */
const BILLED_EXTRAS: Readonly<Record<string, readonly (readonly [item: string, date: string, amount: number, description: string])[]>> = {
  '2025-09': [['Plane Tickets', '2025-09-09', 286.4, 'Flight to the client workshop']],
  '2025-12': [['External Contractor', '2025-12-16', 1200, 'Design review by Pixel Studio']],
  '2026-01': [
    ['Plane Tickets', '2026-01-09', 318.25, 'Flight to the client visit'],
    ['Hotel', '2026-01-10', 412.8, 'Hotel for the client visit'],
  ],
  '2026-05': [['Plane Tickets', '2026-05-09', 244.1, 'Flight to the client visit']],
  '2026-08': [
    ['Hotel', '2026-08-20', 500, 'Hotel for the summer offsite'],
    ['Subscription', '2026-08-31', 60, 'Model API seat'],
  ],
  '2026-09': [['Subscription', '2026-09-30', 60, 'Model API seat']],
}

const MONTH_AND_YEAR = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })

/**
 * The `outgoing-plan` tab of Northwind's work: each worked month's fee and extras add up to its
 * invoice, the extra sprint is a bonus, and October is planned but not invoiced yet. Lumen's
 * invoices have no plan rows. Columns H and I hold a block of the Sheet's own formulas, which the
 * reader skips.
 */
function billingPlanValues(invoices: readonly FakeInvoice[]): CellValue[][] {
  const invoiced = invoices
    .filter((invoice) => invoice.client === 'northwind')
    .flatMap((invoice): CellValue[][] => {
      if (invoice.workedIn === '') {
        return [['Bonus', serialOf(invoice.issued), invoice.amount, 'northwind', invoice.item]]
      }
      const extras = BILLED_EXTRAS[invoice.workedIn] ?? []
      const fee = roundToCent(invoice.amount - extras.reduce((sum, [, , amount]) => sum + amount, 0))
      return [
        ...extras.map(([item, date, amount, description]) => [item, serialOf(date), amount, 'northwind', description]),
        [invoice.workedIn === MONTHS[0] ? 'Part Time Fee' : 'Monthly Fee', serialOf(lastDayOf(invoice.workedIn)), fee, 'northwind', `Fee for ${MONTH_AND_YEAR.format(new Date(`${invoice.workedIn}-01`))}`],
      ]
    })
  const planned: CellValue[][] = [
    ...invoiced,
    ['Monthly Fee', serialOf('2026-10-31'), 7200, 'northwind', 'Fee for October 2026'],
    ['Subscription', serialOf('2026-10-31'), 60, 'Northwind', 'Model API seat'],
  ]
  const formulaBlock: CellValue[][] = [['Name', ''], ['Monthly Amount', 7200], ['Bonus', 4800]]
  return [
    ['item', 'date', 'amount', 'client', 'description', '', '', 'Constants', ''],
    ...planned.map((row, index) => [...row, '', '', ...(formulaBlock[index] ?? [])]),
  ]
}

type RuleSeed = Partial<Record<(typeof RULE_COLUMNS)[number], CellValue>>

/** Rules in trying order, in steps of 100, that reproduce every row flagged `rule`. */
const RULE_SEED: readonly RuleSeed[] = [
  { rule: 'own-account', counterparty_is_own: true, category: 'internal-transfer', note: 'A move between our own accounts.' },
  { rule: 'client-revenue', counterparty_iban: PAYEES.client.iban, direction: 'credit', category: 'revenue', note: 'The client pays invoices from this account.' },
  { rule: 'client-refund', counterparty_iban: PAYEES.client.iban, direction: 'debit', category: 'client-refund' },
  { rule: 'second-client-revenue', counterparty_iban: PAYEES.secondClient.iban, direction: 'credit', category: 'revenue' },
  { rule: 'owner-salary', counterparty_iban: PAYEES.owner.iban, description_starts_with: 'SALARY FOR', category: 'salary-net' },
  { rule: 'owner-rent', counterparty_iban: PAYEES.owner.iban, description_starts_with: 'HOME OFFICE RENT', category: 'rent-owner' },
  { rule: 'owner-guard', counterparty_iban: PAYEES.owner.iban, confidence: 'review', note: 'The owner account carries many purposes, so the rest wait for a person.' },
  { rule: 'pension-fund', counterparty_iban: PAYEES.pension.iban, category: 'payroll-contributions' },
  { rule: 'health-fund', counterparty_iban: PAYEES.health.iban, category: 'payroll-contributions' },
  { rule: 'tax-office-payroll', counterparty_iban: PAYEES.taxOffice.iban, description_starts_with: 'SALARY FOR', category: 'payroll-tax' },
  { rule: 'tax-office-guard', counterparty_iban: PAYEES.taxOffice.iban, confidence: 'review' },
  { rule: 'accountant', counterparty_iban: PAYEES.accountant.iban, category: 'accounting' },
  { rule: 'bank-interest', counterparty_iban: PAYEES.bank.iban, direction: 'credit', category: 'bank-interest' },
  { rule: 'bank-fees', counterparty_iban: PAYEES.bank.iban, direction: 'debit', category: 'bank-fees' },
  { rule: 'merchant-model-api', counterparty_contains: 'MODEL API', category: 'ai-services' },
  { rule: 'merchant-code-host', counterparty_contains: 'CODE HOST', category: 'software-subscriptions' },
  { rule: 'merchant-phone-network', counterparty_contains: 'PHONE NETWORK', category: 'telecom' },
  { rule: 'merchant-airline', counterparty_contains: 'AIRLINE', category: 'travel' },
  { rule: 'merchant-bistro', counterparty_contains: 'BISTRO', category: 'representation' },
  { rule: 'card-review', description_starts_with: 'CARD PURCHASE', category: 'card-purchase-unknown', confidence: 'review', note: 'A card purchase no merchant rule names.' },
]

function rulesValues(): CellValue[][] {
  return [
    [...RULE_COLUMNS],
    ...RULE_SEED.map((seed, index) => {
      const cells: RuleSeed = { order: (index + 1) * 100, enabled: true, confidence: 'rule', ...seed }
      return RULE_COLUMNS.map((column) => cells[column] ?? '')
    }),
  ]
}

/**
 * The bank rows and the invoices they pay. The client is billed at each month's end and pays early
 * the next month, except in the loss month, whose invoice it pays late. One payment runs 120 over
 * its invoice and is refunded, and one runs 500 short, so the newest invoice is part paid. A second
 * client leaves two invoices open, and one credit comes from an IBAN no client names.
 */
function fakeBooks(): { readonly bookings: Booking[]; readonly invoices: FakeInvoice[] } {
  const random = seededRandom(20251)
  const vary = (base: number, spread: number): number => roundToCent(base + (random() - 0.5) * 2 * spread)
  const invoices: FakeInvoice[] = []
  const invoice = (client: string, item: string, amount: number, issued: string, due = addOneMonth(issued), workedIn = ''): void => {
    const year = issued.slice(2, 4)
    const sequence = invoices.filter((earlier) => earlier.client === client && earlier.issued.slice(2, 4) === year).length + 1
    const number = client === 'northwind' ? `${sequence}-1-${year}` : `LL-${String(invoices.filter((earlier) => earlier.client === client).length + 1).padStart(3, '0')}`
    invoices.push({ number, client, item, amount, issued, due, workedIn })
  }
  const all: Booking[] = [
    booking('2025-05-14', 'Alex Example', PAYEES.owner.iban, 'Share capital paid in', 2500, 'share-capital', undefined, 'human'),
    booking('2025-05-20', 'Brightdesk Accounting', PAYEES.accountant.iban, 'Company registration', -450, 'accounting'),
    booking('2025-05-28', 'Laptop Store', '', 'Card purchase, laptop', -1899, 'equipment', undefined, 'human'),
  ]
  for (const month of MONTHS.slice(1)) {
    const isPartMonth = month === MONTHS[MONTHS.length - 1]
    const [year, monthNumber] = month.split('-').map(Number) as [number, number]
    const previous = monthNumber === 1 ? `${year - 1}-12` : `${year}-${String(monthNumber - 1).padStart(2, '0')}`
    const day = (dayOfMonth: number): string => `${month}-${String(dayOfMonth).padStart(2, '0')}`

    const billed = vary(7200, 400)
    const invoiced = previous === '2026-05' ? roundToCent(billed - 120) : previous === '2026-08' ? roundToCent(billed + 500) : billed
    invoice('northwind', `Analytics work, ${previous}`, invoiced, lastDayOf(previous), addOneMonth(lastDayOf(previous)), previous)
    if (month !== LOSS_MONTH) {
      all.push(booking(day(4), PAYEES.client.name, PAYEES.client.iban, `Invoice ${previous}`, billed, 'revenue'))
    }
    if (month === '2026-01') {
      const late = invoices.find((earlier) => earlier.issued === lastDayOf('2025-10'))!
      all.push(booking(day(19), PAYEES.client.name, PAYEES.client.iban, 'Invoice 2025-10, paid late', late.amount, 'revenue'))
    }
    if (month === '2026-04') {
      invoice('northwind', 'Extra sprint', 4800, '2026-03-25')
      all.push(booking(day(4), PAYEES.client.name, PAYEES.client.iban, 'Invoice, extra sprint', 4800, 'revenue'))
    }
    all.push(
      booking(day(5), 'MODEL API SUBSCRIPTION', '', 'Card purchase, monthly plan', -vary(60, 40), 'ai-services'),
      booking(day(6), 'CODE HOST INC', '', 'Card purchase, monthly plan', -10, 'software-subscriptions'),
      booking(day(7), 'PHONE NETWORK', '', 'Card purchase, mobile plan', -vary(14, 3), 'telecom'),
    )
    if (isPartMonth) {
      continue
    }
    all.push(
      booking(day(12), PAYEES.owner.name, PAYEES.owner.iban, `Salary for ${previous}`, -1100, 'salary-net'),
      booking(day(12), PAYEES.owner.name, PAYEES.owner.iban, `Home office rent ${previous}`, -300, 'rent-owner'),
      booking(day(12), PAYEES.pension.name, PAYEES.pension.iban, `Salary for ${previous}`, -250.4, 'payroll-contributions'),
      booking(day(12), PAYEES.health.name, PAYEES.health.iban, `Salary for ${previous}`, -209.6, 'payroll-contributions'),
      booking(day(12), PAYEES.taxOffice.name, PAYEES.taxOffice.iban, `Salary for ${previous}`, -94.2, 'payroll-tax'),
      booking(day(20), PAYEES.accountant.name, PAYEES.accountant.iban, `Bookkeeping ${previous}`, -150, 'accounting'),
      booking(day(28), PAYEES.bank.name, PAYEES.bank.iban, 'Account fee', -vary(9, 5), 'bank-fees'),
    )
    if (monthNumber % 3 === 0) {
      all.push(booking(day(16), PAYEES.contractor.name, PAYEES.contractor.iban, 'Design work', -vary(1500, 300), 'external-contractors', undefined, 'human'))
    }
    if (monthNumber % 4 === 1) {
      all.push(
        booking(day(9), 'AIRLINE EXAMPLE', '', 'Card purchase, client visit', -vary(320, 80), 'travel'),
        booking(day(10), 'BISTRO HARBOUR · business lunch', '', 'Card purchase', -vary(70, 20), 'representation'),
      )
    }
  }
  all.push(
    booking('2025-08-18', PAYEES.insurer.name, PAYEES.insurer.iban, 'Annual policy', -348, 'health-insurance', undefined, 'human'),
    booking('2025-09-15', PAYEES.grantor.name, PAYEES.grantor.iban, 'Start-up grant', 5000, 'grant-income', undefined, 'human'),
    booking('2025-10-02', 'PAPER & INK STORE', '', 'Card purchase', -45.12, 'office-supplies', undefined, 'human'),
    booking(`${LOSS_MONTH}-21`, 'Laptop Store', '', 'Card purchase, workstation', -3400, 'equipment', undefined, 'human'),
    booking('2025-12-03', PAYEES.owner.name, PAYEES.owner.iban, 'Loan to owner', -3000, 'owner-loan-out', undefined, 'human'),
    booking('2025-12-22', PAYEES.owner.name, PAYEES.owner.iban, 'Year-end bonus', -1000, 'salary-bonus', undefined, 'human'),
    booking('2025-12-30', PAYEES.bank.name, PAYEES.bank.iban, 'Interest credited', 0.04, 'bank-interest'),
    booking('2026-02-11', PAYEES.owner.name, PAYEES.owner.iban, 'Refund of travel paid privately', -212.5, 'reimbursement-to-owner', undefined, 'human'),
    // The amounts of the closing sweep are whatever the legacy account holds by then.
    booking(LEGACY_CLOSES, 'Main account', ACCOUNTS.main, 'Account closed, balance moved', 0, 'internal-transfer', 'legacy'),
    booking(LEGACY_CLOSES, 'Legacy account', ACCOUNTS.legacy, 'Account closed, balance moved', 0, 'internal-transfer', 'main'),
    booking('2026-04-28', PAYEES.stateBudget.name, PAYEES.stateBudget.iban, 'Corporate income tax 2025', -3579.97, 'corporate-income-tax', undefined, 'human'),
    ...['2026-05-29', '2026-06-29', '2026-07-30', '2026-08-28'].map((date) =>
      booking(date, PAYEES.stateBudget.name, PAYEES.stateBudget.iban, 'Corporate income tax advance', -447.5, 'corporate-income-tax', undefined, 'human'),
    ),
    booking('2026-05-18', PAYEES.owner.name, PAYEES.owner.iban, 'Dividend 2025', -4000, 'dividend', undefined, 'human'),
    booking('2026-05-18', PAYEES.taxOffice.name, PAYEES.taxOffice.iban, 'Dividend tax 2025', -400, 'dividend-tax', undefined, 'human'),
    booking('2026-05-19', PAYEES.owner.name, PAYEES.owner.iban, 'Loan repaid', 3000, 'owner-loan-repaid', undefined, 'human'),
    booking('2026-06-09', PAYEES.stateBudget.name, PAYEES.stateBudget.iban, 'Tax overpaid in 2025', 180.3, 'tax-refund', undefined, 'human'),
    booking('2026-07-14', PAYEES.client.name, PAYEES.client.iban, 'Refund of an overpayment', -120, 'client-refund'),
    booking('2026-05-22', PAYEES.unknownPayer.name, PAYEES.unknownPayer.iban, 'Payment, no reference', 650, 'revenue', undefined, 'human'),
    booking('2026-07-10', PAYEES.secondClient.name, PAYEES.secondClient.iban, 'Invoice LL-001', 1500, 'revenue'),
    booking('2026-08-08', 'GADGET CORNER', '', 'Card purchase', -38.9, 'equipment', undefined, 'ai'),
    booking('2026-10-05', PAYEES.owner.name, PAYEES.owner.iban, 'Refund of the design tool and the printer paper', -123.2, 'reimbursement-to-owner', undefined, 'human'),
    booking('2026-10-06', PAYEES.owner.name, PAYEES.owner.iban, 'Refund of a parking fee', -38.5, 'reimbursement-to-owner', undefined, 'human'),
    booking('2026-10-08', 'SNACK KIOSK', '', 'Card purchase', -6.4, 'card-purchase-unknown', undefined, 'ai'),
  )
  invoice('lumen', 'Workshop', 1500, '2026-05-12')
  invoice('lumen', 'Data audit', 2400, '2026-06-15', '')
  invoice('lumen', 'Follow-up review', 1800, '2026-08-14')
  return { bookings: all, invoices }
}

function booking(
  date: string,
  counterparty: string,
  iban: string,
  description: string,
  amount: number,
  category: string,
  account?: AccountSlug,
  flaggedBy = 'rule',
): Booking {
  return { date, counterparty, iban, description, amount, category, flaggedBy, ...(account === undefined ? {} : { account }) }
}

interface LedgerRow extends Booking {
  readonly account: AccountSlug
  readonly order: number
  readonly balance: number
  readonly statement: string
  readonly reference: CellValue
}

/** Books every entry in date order, runs each account's balance, then writes the tab newest first. */
function ledgerValues(entries: readonly Booking[]): CellValue[][] {
  const ordered = entries
    .map((entry, order) => ({ ...entry, account: entry.account ?? accountOn(entry.date), order }))
    .sort((earlier, later) => earlier.date.localeCompare(later.date) || earlier.order - later.order)
  const balances: Record<AccountSlug, number> = { legacy: 0, main: 0 }
  const statementNumbers: Record<AccountSlug, number> = { legacy: 0, main: 0 }
  const statementDates: Record<AccountSlug, string> = { legacy: '', main: '' }
  let swept = 0
  const rows: LedgerRow[] = ordered.map((entry, position) => {
    let amount = entry.amount
    if (entry.category === 'internal-transfer') {
      if (entry.account === 'legacy') {
        swept = balances.legacy
      }
      amount = entry.account === 'legacy' ? -swept : swept
    }
    balances[entry.account] = roundToCent(balances[entry.account] + amount)
    if (statementDates[entry.account] !== entry.date) {
      statementDates[entry.account] = entry.date
      statementNumbers[entry.account] += 1
    }
    return {
      ...entry,
      amount,
      balance: balances[entry.account],
      statement: `${entry.date}-statement-${String(statementNumbers[entry.account]).padStart(3, '0')}`,
      // The real tab holds numbers on some rows and text on others.
      reference: entry.account === 'legacy' ? 900_000_000 + position : `FAKE-REF-${String(position).padStart(4, '0')}`,
    }
  })
  const newestFirst = [...rows].reverse()
  return [
    ['date', 'account', 'statement', 'counterparty', 'counterparty_iban', 'description', 'amount', 'balance', 'category', 'flagged_by', 'reference'],
    ...newestFirst.map((row) => [
      serialOf(row.date),
      row.account,
      row.statement,
      row.counterparty,
      row.iban,
      row.description,
      row.amount,
      row.balance,
      row.category,
      row.flaggedBy,
      row.reference,
    ]),
  ]
}

function lastDayOf(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number) as [number, number]
  return new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10)
}

/** The same day a month later, or that month's last day when it is shorter, as the invoice generator sets a due date. */
function addOneMonth(date: string): string {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number]
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  return new Date(Date.UTC(year, month, Math.min(day, lastDay))).toISOString().slice(0, 10)
}

function accountOn(date: string): AccountSlug {
  return date < MAIN_OPENS ? 'legacy' : 'main'
}

function serialOf(date: string): number {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number]
  return (Date.UTC(year, month - 1, day) - Date.UTC(1899, 11, 30)) / 86_400_000
}

function roundToCent(amount: number): number {
  return Math.round(amount * 100) / 100
}

/** A small deterministic generator, so the fixture is the same on every run. */
function seededRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state)
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296
  }
}
