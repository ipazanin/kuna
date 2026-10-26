import { moneyFromAmount } from '../../../../shared/money/money'
import { RULE_COLUMNS } from '../../../rules/domain/rule'
import { ID_FIELD } from '../../domain/recordCodec'
import { amountText, filledFields } from '../../domain/recordFields'
import type { FieldValue, RecordFields } from '../../domain/recordFields'
import type { WorkbookSource } from '../../domain/workbook'
import type { WorkbookDocument } from '../documentFormat'
import { newDocument } from '../documentRecordStorage'
import { COMPANY_APP } from '../documentStorePorts'

/**
 * A synthetic workbook for fake mode and tests. Every name, IBAN and amount is made up. It spans
 * eighteen months from a part-month opening to a part-month at the end, on two accounts, one of
 * which closes with a transfer to the other, and it holds one loss month.
 *
 * The id doubles as the marker `assert-no-fake-bytes` looks for in a production bundle.
 */
export const FAKE_WORKBOOK_ID = 'FAKE-WORKBOOK-ONLY-DO-NOT-SHIP'

/** A record's fields as the fake writes them, a blank one left out. */
export type FakeFields = Readonly<Record<string, FieldValue | number | null | undefined>>

/** A row a made-up payroll pays, to an employee or to a payee of the contributions. */
export interface FakePayment {
  readonly counterparty: string
  readonly iban: string
  readonly description: string
  readonly amount: number
  readonly category: string
}

/** The people a fake variant pays in place of the owner's flat salary, with each payday's rows. */
export interface FakeStaff {
  /** The rows of the employees tab. */
  readonly employees: readonly FakeFields[]
  /** The rows paid on the 12th of `paidIn` for `worked`, the month before it, both `YYYY-MM`. */
  payday(paidIn: string, worked: string): readonly FakePayment[]
}

/** The `roles` column as the shadow-accounting Sheet seeds it. Salary and rent are paid in the month after the work, hence `arrears`. */
const CATEGORY_ROLES: Readonly<Record<string, string>> = {
  revenue: 'revenue',
  'grant-income': 'grant',
  'client-refund': 'client-refund',
  'payroll-contributions': 'watched, owner-pay-tax, arrears',
  'payroll-tax': 'owner-pay-tax, arrears',
  'corporate-income-tax': 'corporate-income-tax',
  'dividend-tax': 'owner-pay-tax, profit-distribution',
  'salary-net': 'salary, arrears',
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
  'benefits-from-company-costs': 'owner-benefit',
}

/** The `owner_share` column: the default share of the one category the owner partly enjoys privately. */
const CATEGORY_OWNER_SHARES: Readonly<Record<string, number>> = {
  'ai-services': 50,
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

/**
 * Colours picked on Settings, Categories: every swatch, Blue twice in one bucket, and a few blanks.
 * The rest keep the seed's pastel, which reads as the bucket colour. The benefits category wears
 * Violet, so it takes none of the owner pay chart's free slots.
 */
const CATEGORY_COLOURS: Readonly<Record<string, string>> = {
  'benefits-from-company-costs': '#6250d6',
  consulting: '#1baf7a',
  'external-contractors': '#eb6834',
  'software-subscriptions': '#2a78d6',
  travel: '#2a78d6',
  telecom: '#eda100',
  dividend: '#e87ba4',
  equipment: '#008300',
  'ai-services': '#e34948',
  'corporate-income-tax': '#6250d6',
  'bank-fees': '#a3adb9',
  'office-supplies': '',
  accounting: '',
  'payroll-tax': '',
  'rent-owner': '',
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
      ['benefits-from-company-costs', 'owner-pay'],
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
  /** A share of the row's own, over its category's default. */
  readonly ownerShare?: number
}

/** What the owner's flat salary and its contributions take out of the bank each payday. */
const FLAT_PAYROLL = -(1100 + 250.4 + 209.6 + 94.2)

const MONTHS = [
  '2025-05', '2025-06', '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01',
  '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10',
] as const

/** The month with no client payment and a large purchase, so its net is negative. */
const LOSS_MONTH = '2025-11'

/**
 * The made-up company's records, by kind. As a Drive file its settings hold a blank
 * `card_settlement_ibans` and the invoice details, so every other default applies. As a workbook
 * kept in this browser they also name the company, the way a new user would, and its director is on
 * the employees tab. Rows the rules do not
 * reproduce are flagged as a person's, so Review has coverage gaps to show. The records of the
 * kinds without a business key, and every ledger row, carry a fixed id.
 */
export function fakeWorkbookRecords(source: WorkbookSource = 'drive', staff: FakeStaff | null = null): Readonly<Record<string, readonly RecordFields[]>> {
  const records = fakeKinds(source, staff)
  return Object.fromEntries(Object.entries(records).map(([kind, held]) => [kind, held.map((fields, index) => recordFields(withFixedId(kind, fields, index)))]))
}

/** The made-up company's books as the document a Drive file or this browser holds. */
export function fakeWorkbookDocument(savedAt: string, source: WorkbookSource = 'drive', staff: FakeStaff | null = null): WorkbookDocument {
  return newDocument(COMPANY_APP, fakeWorkbookRecords(source, staff), savedAt)
}

/** The kinds whose records carry an id, each with its place in the fixed ids, so every run gives the same ids. */
const FIXED_IDS: Readonly<Record<string, number>> = {
  'billing-item': 1,
  'hr-doo.owner-advance': 2,
  'hr-doo.asset': 3,
  'hr-doo.year-end-line': 4,
  'hr-doo.plan-line': 5,
  'split-part': 6,
  dismissal: 7,
  'ledger-row': 8,
}

function withFixedId(kind: string, fields: FakeFields, index: number): FakeFields {
  const place = FIXED_IDS[kind]
  return place === undefined ? fields : { ...fields, [ID_FIELD]: `00000000-0000-4000-8000-${String(place).padStart(4, '0')}${String(index + 1).padStart(8, '0')}` }
}

/** The fields as text, a number as its decimal text. */
function recordFields(fields: FakeFields): RecordFields {
  return filledFields(Object.fromEntries(Object.entries(fields).map(([name, value]) => [name, typeof value === 'number' ? String(value) : value])))
}

/** An amount as the file holds it, decimal text from its cents. */
function money(amount: number): string {
  return amountText(moneyFromAmount(amount))
}

/** What the made-up company's invoices print. The invoice folder is left to pick, as on a first run. */
const FAKE_INVOICING: readonly (readonly [key: string, value: string])[] = [
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

/** The owner, whom a fake payroll pays under the name and account the rest of the fake knows. */
export const FAKE_OWNER = PAYEES.owner

const setting = ([key, value]: readonly [string, FieldValue | number]): FakeFields => ({ key, value })

function fakeKinds(source: WorkbookSource, staff: FakeStaff | null): Readonly<Record<string, readonly FakeFields[]>> {
  const { bookings, invoices } = fakeBooks(staff)
  const ledger = ledgerRecords(bookings)
  return {
    setting:
      source === 'drive'
        ? [{ key: 'card_settlement_ibans' }, ...FAKE_INVOICING.map(setting)]
        : [
            ...(
              [
                ['template_version', 1],
                ['company_name', 'Example Studio'],
                ['currency', 'EUR'],
                ['hr_company_registered', '2025-05-12'],
                ['hr_owner_loan_interest', 0.025],
                ['hr_vat_returns_folder', 'work/dss/dss-finance/vat-returns'],
                ['hr_payroll_folder', 'work/dss/dss-finance/payroll'],
                ['billing_monthly_amount', 7200],
                ['billing_monthly_item', 'Monthly Fee'],
                ['billing_subscription_amount', 60],
                ['billing_subscription_item', 'Subscription'],
                ['billing_bonus_amount', 4800],
                ['billing_bonus_item', 'Bonus'],
                ['billing_client', 'northwind'],
              ] as const
            ).map(setting),
            ...FAKE_INVOICING.map(setting),
          ],
    'ledger-row': ledger,
    category: CATEGORY_SEED.flatMap((group) =>
      group.categories.map(([category, bucket]) => ({
        category,
        family: group.family,
        bucket,
        colour: CATEGORY_COLOURS[category] ?? group.colour,
        roles: CATEGORY_ROLES[category],
        vat: CATEGORY_VAT[category],
        owner_share: CATEGORY_OWNER_SHARES[category],
      })),
    ),
    account: Object.entries(ACCOUNTS).map(([account, iban]) => ({ account, iban })),
    rule: ruleRecords(),
    invoice: invoices.map((invoice) => ({
      number: invoice.number,
      client: invoice.client,
      item: invoice.item,
      amount: money(invoice.amount),
      issued: invoice.issued,
      due: invoice.due,
      period_from: invoice.workedIn === '' ? '' : `${invoice.workedIn}-01`,
      period_to: invoice.workedIn === '' ? '' : lastDayOf(invoice.workedIn),
    })),
    client: [
      {
        client: 'northwind',
        name: 'Northwind Analytics',
        iban: PAYEES.client.iban,
        address: '1 Example Road, London',
        country: 'United Kingdom',
        tax_id: 'GB000000000',
        invoice_mail: 'accounts@northwind.example',
        mail_language: 'en',
        reverse_charge: true,
      },
      { client: 'lumen', name: 'Lumen Labs', iban: PAYEES.secondClient.iban },
    ],
    'billing-item': billingPlanRecords(invoices),
    'hr-doo.owner-advance': [
      { date: '2026-02-03', amount: money(212.5), description: 'Train tickets to the client, paid privately', category: 'travel' },
      { date: '2026-08-21', amount: money(89), description: 'Design tool, annual plan on the owner’s card', category: 'software-subscriptions', owner_share: 25 },
      { date: '2026-09-30', amount: money(34.2), description: 'Printer paper', category: 'office-supplies' },
    ],
    'split-part': splitRecords(ledger),
    dismissal: [],
    ...planningRecords(),
    ...(staff !== null
      ? { 'hr-doo.employee': staff.employees }
      : source === 'drive'
        ? {}
        : { 'hr-doo.employee': [{ employee: 'alex', name: 'Alex Čolić', iban: PAYEES.owner.iban, residence_city: 'Zagreb', pension_pillar_2: true, birth_year: 1990, from: '2025-06-01', director: true }] }),
  }
}

/**
 * The tabs the year-end and planning screens read, for "Example Studio d.o.o.": the two computers
 * the ledger bought, the start-up grant it received, the accountant's 2025 figures, a 2026 plan row
 * the ledger's months compare with, a 2027 plan whose owner pay switches from the floor salary to
 * board-only insurance the day after the grant's employment date, with a purchase and a dividend,
 * and four owner pay scenarios for 2027, two of them with warnings to show. The accountant's 2025 figures are made up to agree with the accrual view of
 * the ledger, except where the Accountant tab of Year needs something to show: the grant released, rent
 * placed on other costs, bank interest as financial income and 10.00 moved between two konto lines.
 */
function planningRecords(): Readonly<Record<string, readonly FakeFields[]>> {
  /** A money line's amount as an amount, and a date, a rate or a count as given. */
  const yearEnd = (statement: string, line: string, label: string, amount: number | string, categories = ''): FakeFields => ({
    year: 2025,
    statement,
    line,
    label,
    amount: typeof amount === 'number' ? money(amount) : amount,
    categories,
    source: 'example-studio-2025-package.pdf',
  })
  return {
    'hr-doo.asset': [
      { asset: 'Laptop 14 inch', bought: '2025-05-28', in_use: '2025-06-01', cost_net: money(1519.2), group: 'computers', ledger_reference: 'Card purchase, laptop' },
      {
        asset: 'Workstation',
        bought: '2025-11-21',
        in_use: '2025-11-24',
        cost_net: money(2720),
        group: 'computers',
        funded_by: 'startup-grant',
        ledger_reference: 'Card purchase, workstation',
        note: 'Paid from the grant',
      },
    ],
    'hr-doo.grant': [
      {
        grant: 'startup-grant',
        received: '2025-09-15',
        amount: money(5000),
        fixed_part: money(2000),
        variable_part: money(3000),
        period_from: '2025-09-15',
        period_to: '2027-09-14',
        release: 'fixed-then-assets',
        clawback_year1: 'whole',
        clawback_year2: money(2500),
        employment_required_until: '2027-09-14',
        note: 'Regional start-up grant',
      },
    ],
    'hr-doo.year-end-line': [
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
      yearEnd('balance', 'receivables-members-employees', 'Potraživanja od zaposlenika i članova poduzetnika', 3013.45),
      yearEnd('balance', 'receivables-state', 'Potraživanja od države', 2400.63),
      yearEnd('balance', 'cash', 'Novac u banci i blagajni', 19363.93),
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
      yearEnd('tax', 'rate', 'Porezna stopa', '0.1'),
      yearEnd('tax', 'liability', 'Porezna obveza', 3579.97),
      yearEnd('tax', 'advances-paid', 'Plaćeni predujmovi', 0),
      yearEnd('tax', 'balance-due', 'Razlika za uplatu', 3579.97),
      yearEnd('tax', 'monthly-advance', 'Mjesečni predujam', 447.5),
      yearEnd('tax', 'months-of-operation', 'Broj mjeseci', '8'),
      yearEnd('tax', 'filed-on', 'Predano', '2026-04-27'),
      yearEnd('tax', 'paid-on', 'Plaćeno', '2026-04-28'),
      yearEnd('distribution', 'retained', 'Zadržana dobit', 27784.71),
      yearEnd('distribution', 'dividend', 'Isplata dobiti', 4400),
      yearEnd('distribution', 'decided-on', 'Odluka o raspodjeli dobiti', '2026-05-15'),
      yearEnd('grant', 'released-in-year', 'Prihod od potpore', 2050),
      yearEnd('grant', 'deferred-at-year-end', 'Odgođeni prihod od potpore', 2950),
      yearEnd('konto', '41200', 'Usluge telefona', 82.04, 'telecom'),
      yearEnd('konto', '41810', 'Računovodstvene usluge', 1196, 'accounting'),
      yearEnd('konto', '41850', 'Softver i pretplate', 435.87, 'ai-services, software-subscriptions'),
      yearEnd('konto', '46500', 'Reprezentacija', 70, 'representation'),
    ],
    'hr-doo.plan-line': [
      { year: 2026, item: 'ai-services', amount: money(55), note: 'Model API seats' },
      { year: 2026, item: 'purchase', amount: money(420), note: 'Second monitor', date: '2026-11-12', group: 'equipment' },
      { year: 2027, item: 'software-subscriptions', amount: money(10) },
      { year: 2027, month: 1, item: 'software-subscriptions', amount: money(120), note: 'Yearly design tool' },
      { year: 2027, item: 'owner_pay_scenario', amount: 'floor-salary' },
      { year: 2027, item: 'owner_pay_scenario', amount: 'floor-then-board', date: '2027-09-15' },
      { year: 2027, item: 'purchase', amount: money(1600), note: 'Replacement laptop', date: '2027-03-10', group: 'computers' },
      { year: 2027, month: 6, item: 'dividend', amount: money(8000), note: 'After the 2026 statements are adopted' },
    ],
    'hr-doo.scenario-component': (
      [
        ['floor-salary', 'Floor salary all year', 'salary_gross', 'floor', '', ''],
        ['floor-salary', '', 'dividend', 'max', '', ''],
        ['floor-extras', 'Floor salary, tax-free items and rent', 'salary_gross', 'floor', '', ''],
        ['floor-extras', '', 'nontaxable:results-bonus', money(1200), '', ''],
        ['floor-extras', '', 'nontaxable:occasional-gift', money(900), '2027-12-01', ''],
        ['floor-extras', '', 'rent_monthly', money(350), '', ''],
        ['floor-extras', '', 'dividend', 'max', '', ''],
        ['floor-then-board', 'Floor salary, then board member only', 'salary_gross', 'floor', '', '2027-09-14'],
        ['floor-then-board', '', 'director_basis', 'board-only', '2027-09-15', ''],
        ['floor-then-board', '', 'dividend', 'max', '', ''],
        ['early-exit', 'Salary stops in June, large payout', 'salary_gross', money(2000), '', '2027-06-30'],
        ['early-exit', '', 'director_basis', 'insured-elsewhere', '2027-07-01', ''],
        ['early-exit', '', 'dividend', money(120000), '', ''],
      ] as const
    ).map(([scenario, label, component, amount, from, to]) => ({ scenario, label, year: 2027, component, amount, from, to })),
  }
}

interface FakeSplit {
  readonly date: string
  readonly counterparty: string
  readonly description: string
  readonly parts: readonly (readonly [category: string, amount: number | null, note: string, ownerShare?: number])[]
}

/**
 * Four ledger rows split into parts, each found by its day, counterparty and description: a June
 * salary paid with a results bonus, a design invoice that also paid a workshop, a business lunch
 * with the owner's own share in it, and an office order with a private item in it. The last part of
 * each takes a fixed amount and the first the rest.
 */
const SPLIT_ROWS: readonly FakeSplit[] = [
  { date: '2026-07-12', counterparty: PAYEES.owner.name, description: 'Salary for 2026-06', parts: [['salary-net', null, 'Net salary'], ['salary-bonus', 200, 'Results bonus paid with the salary']] },
  { date: '2026-03-16', counterparty: PAYEES.contractor.name, description: 'Design work', parts: [['external-contractors', null, 'Design work'], ['consulting', 400, 'Workshop facilitation']] },
  { date: '2026-05-10', counterparty: 'BISTRO HARBOUR · business lunch', description: 'Card purchase', parts: [['representation', null, 'Client lunch'], ['owner-loan-out', 25, 'The owner’s own lunch']] },
  { date: '2025-10-02', counterparty: 'PAPER & INK STORE', description: 'Card purchase', parts: [['office-supplies', null, 'Paper and ink for the office', 20], ['owner-loan-out', 13.45, 'Private share of the paper and ink order']] },
]

function splitRecords(ledger: readonly FakeFields[]): FakeFields[] {
  return SPLIT_ROWS.flatMap((split) => {
    const row = ledger.find((fields) => fields.date === split.date && fields.counterparty === split.counterparty && fields.description === split.description)
    if (row === undefined) {
      throw new Error(`The fake ledger has no row "${split.description}" on ${split.date} to split.`)
    }
    const amount = Number(row.amount)
    const fixed = split.parts.reduce((sum, [, part]) => sum + (part ?? 0), 0)
    return split.parts.map(([category, part, note, ownerShare]) => ({
      date: row.date,
      account: row.account,
      row_amount: row.amount,
      row_balance: row.balance,
      amount: money(part === null ? roundToCent(amount + fixed) : -part),
      category,
      note,
      owner_share: ownerShare,
    }))
  })
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
 * invoices have no plan rows.
 */
function billingPlanRecords(invoices: readonly FakeInvoice[]): FakeFields[] {
  const item = (name: string, date: string, amount: number, client: string, description: string): FakeFields => ({ item: name, date, amount: money(amount), client, description })
  const invoiced = invoices
    .filter((invoice) => invoice.client === 'northwind')
    .flatMap((invoice): FakeFields[] => {
      if (invoice.workedIn === '') {
        return [item('Bonus', invoice.issued, invoice.amount, 'northwind', invoice.item)]
      }
      const extras = BILLED_EXTRAS[invoice.workedIn] ?? []
      const fee = roundToCent(invoice.amount - extras.reduce((sum, [, , amount]) => sum + amount, 0))
      return [
        ...extras.map(([name, date, amount, description]) => item(name, date, amount, 'northwind', description)),
        item(invoice.workedIn === MONTHS[0] ? 'Part Time Fee' : 'Monthly Fee', lastDayOf(invoice.workedIn), fee, 'northwind', `Fee for ${MONTH_AND_YEAR.format(new Date(`${invoice.workedIn}-01`))}`),
      ]
    })
  return [...invoiced, item('Monthly Fee', '2026-10-31', 7200, 'northwind', 'Fee for October 2026'), item('Subscription', '2026-10-31', 60, 'Northwind', 'Model API seat')]
}

type RuleSeed = Partial<Record<(typeof RULE_COLUMNS)[number], FieldValue | number>>

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

function ruleRecords(): FakeFields[] {
  return RULE_SEED.map((seed, index) => ({ order: (index + 1) * 100, enabled: true, confidence: 'rule', ...seed }))
}

/**
 * The bank rows and the invoices they pay. The client is billed at each month's end and pays early
 * the next month, except in the loss month, whose invoice it pays late. One payment runs 120 over
 * its invoice and is refunded, and one runs 500 short, so the newest invoice is part paid. A second
 * client leaves two invoices open, and one credit comes from an IBAN no client names.
 */
function fakeBooks(staff: FakeStaff | null): { readonly bookings: Booking[]; readonly invoices: FakeInvoice[] } {
  const random = seededRandom(20251)
  let staffDifference = 0
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
    booking('2025-05-20', 'Brightdesk Accounting', PAYEES.accountant.iban, 'Company registration', -445, 'accounting'),
    { ...booking('2025-05-28', 'Laptop Store', '', 'Card purchase, laptop', -1899, 'equipment', undefined, 'human'), ownerShare: 30 },
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
    const rent = booking(day(12), PAYEES.owner.name, PAYEES.owner.iban, `Home office rent ${previous}`, -300, 'rent-owner')
    const staffPaid = staff?.payday(month, previous) ?? []
    staffDifference = roundToCent(staffDifference + FLAT_PAYROLL - staffPaid.reduce((sum, paid) => sum + paid.amount, 0))
    all.push(
      ...(staff === null
        ? [
            booking(day(12), PAYEES.owner.name, PAYEES.owner.iban, `Salary for ${previous}`, -1100, 'salary-net'),
            rent,
            booking(day(12), PAYEES.pension.name, PAYEES.pension.iban, `Salary for ${previous}`, -250.4, 'payroll-contributions'),
            booking(day(12), PAYEES.health.name, PAYEES.health.iban, `Salary for ${previous}`, -209.6, 'payroll-contributions'),
            booking(day(12), PAYEES.taxOffice.name, PAYEES.taxOffice.iban, `Salary for ${previous}`, -94.2, 'payroll-tax'),
          ]
        : [...staffPaid.map((paid) => booking(day(12), paid.counterparty, paid.iban, paid.description, paid.amount, paid.category)), rent]),
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
    booking('2025-10-02', 'PAPER & INK STORE', '', 'Card purchase', -53.86, 'office-supplies', undefined, 'human'),
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
  if (staff !== null && staffDifference !== 0) {
    // The main account then ends where the flat salary leaves it, so the statements folder's sample carries it on.
    all.push(booking('2026-10-05', PAYEES.owner.name, PAYEES.owner.iban, staffDifference > 0 ? 'Share capital paid in' : 'Share capital paid back', staffDifference, 'share-capital', undefined, 'human'))
  }
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
  readonly reference: string
}

/** Books every entry in date order, runs each account's balance, then lists the rows newest first. */
function ledgerRecords(entries: readonly Booking[]): FakeFields[] {
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
      // The live ledger's references are digits on some rows and letters on others.
      reference: entry.account === 'legacy' ? String(900_000_000 + position) : `FAKE-REF-${String(position).padStart(4, '0')}`,
    }
  })
  return [...rows].reverse().map((row) => ({
    date: row.date,
    account: row.account,
    statement: row.statement,
    counterparty: row.counterparty,
    counterparty_iban: row.iban,
    description: row.description,
    amount: money(row.amount),
    balance: money(row.balance),
    category: row.category,
    flagged_by: row.flaggedBy,
    reference: row.reference,
    owner_share: row.ownerShare ?? CATEGORY_OWNER_SHARES[row.category],
  }))
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
