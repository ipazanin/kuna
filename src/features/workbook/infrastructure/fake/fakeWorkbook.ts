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

/** The categories seed of the shadow-accounting Sheet, as its `categories` tab starts out. */
const CATEGORY_SEED: readonly { readonly family: string; readonly colour: string; readonly categories: readonly (readonly [string, string])[] }[] = [
  {
    family: 'income',
    colour: '#d7f0e5',
    categories: [
      ['revenue', 'income'],
      ['grant-income', 'income'],
      ['tax-refund', 'income'],
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
 * As a Google Sheet it has no `settings` tab, like the owner's Sheet, so every default applies. As a
 * workbook kept in this browser it names its company, the way a template user would.
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
    },
    ledger: sheetRowsFromValues(values.ledger),
    categories: sheetRowsFromValues(values.categories),
    accounts: sheetRowsFromValues(values.accounts),
    settings: sheetRowsFromValues(values.settings),
  }
}

/** The tabs as the Sheets API returns them: header row first, dates as serial numbers. */
export function fakeWorkbookValues(source: WorkbookSource = 'google'): Record<WorkbookTab, CellValue[][]> {
  return {
    settings: source === 'google' ? [] : [['key', 'value'], ['template_version', 1], ['company_name', 'Example Studio'], ['currency', 'EUR']],
    ledger: ledgerValues(bookings()),
    categories: [
      ['category', 'family', 'bucket', 'colour'],
      ...CATEGORY_SEED.flatMap((group) => group.categories.map(([category, bucket]) => [category, group.family, bucket, group.colour])),
    ],
    accounts: [['account', 'iban'], ...Object.entries(ACCOUNTS).map(([account, iban]) => [account, iban])],
  }
}

function bookings(): Booking[] {
  const random = seededRandom(20251)
  const vary = (base: number, spread: number): number => roundToCent(base + (random() - 0.5) * 2 * spread)
  const all: Booking[] = [
    booking('2025-05-14', 'Alex Example', PAYEES.owner.iban, 'Share capital paid in', 2500, 'share-capital'),
    booking('2025-05-20', 'Brightdesk Accounting', PAYEES.accountant.iban, 'Company registration', -450, 'accounting'),
    booking('2025-05-28', 'Laptop Store', '', 'Card purchase, laptop', -1899, 'equipment'),
  ]
  for (const month of MONTHS.slice(1)) {
    const isPartMonth = month === MONTHS[MONTHS.length - 1]
    const [year, monthNumber] = month.split('-').map(Number) as [number, number]
    const previous = monthNumber === 1 ? `${year - 1}-12` : `${year}-${String(monthNumber - 1).padStart(2, '0')}`
    const day = (dayOfMonth: number): string => `${month}-${String(dayOfMonth).padStart(2, '0')}`

    if (month !== LOSS_MONTH) {
      all.push(booking(day(4), PAYEES.client.name, PAYEES.client.iban, `Invoice ${previous}`, vary(7200, 400), 'revenue'))
    }
    if (month === '2026-04') {
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
      all.push(booking(day(16), PAYEES.contractor.name, PAYEES.contractor.iban, 'Design work', -vary(1500, 300), 'external-contractors'))
    }
    if (monthNumber % 4 === 1) {
      all.push(
        booking(day(9), 'AIRLINE EXAMPLE', '', 'Card purchase, client visit', -vary(320, 80), 'travel'),
        booking(day(10), 'BISTRO HARBOUR · business lunch', '', 'Card purchase', -vary(70, 20), 'representation'),
      )
    }
  }
  all.push(
    booking('2025-08-18', PAYEES.insurer.name, PAYEES.insurer.iban, 'Annual policy', -348, 'health-insurance'),
    booking('2025-09-15', PAYEES.grantor.name, PAYEES.grantor.iban, 'Start-up grant', 5000, 'grant-income'),
    booking('2025-10-02', 'PAPER & INK STORE', '', 'Card purchase', -45.12, 'office-supplies'),
    booking(`${LOSS_MONTH}-21`, 'Laptop Store', '', 'Card purchase, workstation', -3400, 'equipment'),
    booking('2025-12-03', PAYEES.owner.name, PAYEES.owner.iban, 'Loan to owner', -3000, 'owner-loan-out'),
    booking('2025-12-22', PAYEES.owner.name, PAYEES.owner.iban, 'Year-end bonus', -1000, 'salary-bonus'),
    booking('2025-12-30', PAYEES.bank.name, PAYEES.bank.iban, 'Interest credited', 0.04, 'bank-interest'),
    booking('2026-02-11', PAYEES.owner.name, PAYEES.owner.iban, 'Refund of travel paid privately', -212.5, 'reimbursement-to-owner'),
    // The amounts of the closing sweep are whatever the legacy account holds by then.
    booking(LEGACY_CLOSES, 'Main account', ACCOUNTS.main, 'Account closed, balance moved', 0, 'internal-transfer', 'legacy'),
    booking(LEGACY_CLOSES, 'Legacy account', ACCOUNTS.legacy, 'Account closed, balance moved', 0, 'internal-transfer', 'main'),
    booking('2026-04-28', PAYEES.stateBudget.name, PAYEES.stateBudget.iban, 'Corporate income tax 2025', -1650, 'corporate-income-tax'),
    booking('2026-05-18', PAYEES.owner.name, PAYEES.owner.iban, 'Dividend 2025', -4000, 'dividend'),
    booking('2026-05-18', PAYEES.taxOffice.name, PAYEES.taxOffice.iban, 'Dividend tax 2025', -400, 'dividend-tax'),
    booking('2026-05-19', PAYEES.owner.name, PAYEES.owner.iban, 'Loan repaid', 3000, 'owner-loan-repaid'),
    booking('2026-06-09', PAYEES.stateBudget.name, PAYEES.stateBudget.iban, 'Tax overpaid in 2025', 180.3, 'tax-refund'),
    booking('2026-07-14', PAYEES.client.name, PAYEES.client.iban, 'Refund of a double payment', -120, 'client-refund'),
    booking('2026-08-08', 'GADGET CORNER', '', 'Card purchase', -38.9, 'unknown', undefined, 'ai'),
    booking('2026-10-08', 'SNACK KIOSK', '', 'Card purchase', -6.4, 'card-purchase-unknown', undefined, 'ai'),
  )
  return all
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
  const familyOf = new Map(CATEGORY_SEED.flatMap((group) => group.categories.map(([category, bucket]) => [category, { family: group.family, bucket }])))
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
    ['date', 'account', 'statement', 'counterparty', 'counterparty_iban', 'description', 'amount', 'balance', 'category', 'family', 'bucket', 'month', 'flagged_by', 'reference'],
    ...newestFirst.map((row) => {
      const defined = familyOf.get(row.category)
      return [
        serialOf(row.date),
        row.account,
        row.statement,
        row.counterparty,
        row.iban,
        row.description,
        row.amount,
        row.balance,
        row.category,
        defined?.family ?? 'unclassified',
        defined?.bucket ?? 'unclassified',
        row.date.slice(0, 7),
        row.flaggedBy,
        row.reference,
      ]
    }),
  ]
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
