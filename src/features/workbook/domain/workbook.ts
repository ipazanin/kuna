import type { CivilDate } from '../../../shared/calendar/civilDate'
import type { DateRange } from '../../../shared/calendar/dateRange'
import { anchorWindow } from '../../../shared/calendar/ledgerWindow'
import type { LedgerWindow } from '../../../shared/calendar/ledgerWindow'
import { negateMoney } from '../../../shared/money/money'
import type { Money } from '../../../shared/money/money'
import { naturalOrder } from '../../../shared/text/naturalOrder'
import type { OwnerPart, OwnerPartOf } from '../../owner-share/domain/ownerParts'
import type { OwnerShare } from '../../owner-share/domain/ownerShare'
import type { Rule } from '../../rules/domain/rule'
import type { Settings } from '../../settings/domain/settings'
import type { BillingItem } from './billingPlan'
import type { Bucket, DefinedBucket } from './bucket'
import type { CategoryColour } from './categoryColour'
import type { Dismissal } from './dismissals'
import { recordIdOf } from './recordId'
import type { RecordId } from './recordId'
import { CATEGORY_RECORDS } from './recordKind'
import type { VatTreatment } from './vatTreatment'
import type { LedgerSplit } from './splits'

export interface Category {
  readonly slug: string
  /** What the screens call it, when the tab gives a name. The slug stays the identity. */
  readonly label?: string
  readonly family: string
  readonly bucket: DefinedBucket
  readonly colour: CategoryColour
  /** What code may select the category for, such as `revenue` or `watched`. Lower case. */
  readonly roles: readonly string[]
  /** How a purchase in it splits into cost and VAT. */
  readonly vat: VatTreatment
  /** The share a row takes when it is filed in the category. */
  readonly ownerShare: OwnerShare | null
}

/** A category's record id, which its slug makes. */
export function categoryIdOf(category: Pick<Category, 'slug'>): RecordId {
  return recordIdOf(CATEGORY_RECORDS, category.slug)
}

export interface Account {
  readonly slug: string
  /** What the screens call it, when the tab gives a name. The slug stays the identity. */
  readonly label?: string
  readonly iban: string
  /** Blank when the tab does not say, which means the workbook's currency. */
  readonly currency: string
}

/** Where the workbook lives: a Google Sheet, or this browser with xlsx files as its copies. */
export type WorkbookSource = 'google' | 'excel'

/**
 * What a camt statement said about an entry beyond its money, from ledger columns O to T. Every
 * field is blank on a row from a statement PDF or typed by hand.
 */
export interface TransactionSignals {
  readonly purpose: string
  readonly txDomain: string
  readonly txFamily: string
  readonly txSubFamily: string
  readonly creditorReference: string
  readonly instructedCurrency: string
}

/** One booked bank entry from the `ledger` tab. Credits are positive. */
export interface Transaction {
  readonly account: string
  readonly date: CivilDate
  /**
   * Booking order across the whole ledger, oldest first, as `bookingOrder` derives it from the
   * fields: by date, then by account name, then in the order each account's balances chain. So the
   * highest sequence on an account's latest date is its closing balance.
   */
  readonly sequence: number
  readonly statement: string
  readonly counterparty: string
  readonly counterpartyIban: string
  readonly description: string
  readonly amount: Money
  /** The account's running balance after this entry. */
  readonly balance: Money
  /** Empty when the cell is blank. */
  readonly category: string
  readonly family: string
  readonly bucket: Bucket
  readonly flaggedBy: string
  readonly reference: string
  readonly signals: TransactionSignals
  /** Why the statement parser wants a person to look at the row, such as `reversal`. Column U. */
  readonly reviewReasons: readonly string[]
  /** The row's own share, copied from its category when the row was filed. A part of a split row holds the part's. */
  readonly ownerShare: OwnerShare | null
  /** By its key: its account and reference, or for a row without a reference its account, day, amount, balance and description. */
  readonly id: RecordId
  /** Set on a part of a split bank row, which the screens count in the row's place. */
  readonly split?: SplitPartOf
  /** Set on a part of a shared row, which the cash screens count in the row's place. */
  readonly ownerPart?: OwnerPartOf<Transaction>
}

/** Where a part of a split row comes from: the bank row as booked, and the part's place among its parts. */
export interface SplitPartOf {
  readonly whole: Transaction
  /** From 0, larger parts first. */
  readonly index: number
  readonly count: number
  readonly note: string
  /** The part's own id. */
  readonly id: RecordId
}

/** What profit and loss counts of a row: a bank transaction, or a cost the owner paid privately. */
export type Booking = Pick<Transaction, 'date' | 'amount' | 'category' | 'family' | 'bucket'> & { readonly ownerPart?: OwnerPart }

/** One invoice on the `invoices` tab, which the invoice generator appends to. */
export interface Invoice {
  /** Text, such as `1-1-26`. */
  readonly number: string
  /** The client slug, as the `clients` tab names it. */
  readonly client: string
  readonly item: string
  readonly amount: Money
  readonly issued: CivilDate
  /** Null when the tab leaves it blank. */
  readonly due: CivilDate | null
  /** The period the work was delivered in, or null when the tab leaves it blank and the issue date stands for it. */
  readonly deliveryPeriod: DateRange | null
  /** By its client and number. */
  readonly id: RecordId
}

/** The order invoices were issued in: by issue date, then by number, with the numbers inside it compared as numbers. */
export function invoiceOrder(earlier: Pick<Invoice, 'issued' | 'number'>, later: Pick<Invoice, 'issued' | 'number'>): number {
  return earlier.issued.localeCompare(later.issued) || naturalOrder(earlier.number, later.number)
}

/** A client from the `clients` tab, one row per client. */
export interface Client {
  readonly slug: string
  /** Blank when the row names none. */
  readonly name: string
  /** Normalised. A payment from one of them is the client's. */
  readonly ibans: readonly string[]
  readonly invoicing: ClientInvoicing
}

/** What an invoice to the client prints and where its mail goes, blank where the row gives nothing. */
export interface ClientInvoicing {
  readonly address: string
  readonly country: string
  readonly taxId: string
  /** Who the invoice mail goes to. */
  readonly invoiceMail: string
  /** A language tag such as en or hr, for the month's name in the mail. English when blank. */
  readonly mailLanguage: string
  /** True when the client accounts for the VAT, so the invoice carries none and prints the reverse-charge note. */
  readonly reverseCharge: boolean
}

export const NO_CLIENT_INVOICING: ClientInvoicing = { address: '', country: '', taxId: '', invoiceMail: '', mailLanguage: '', reverseCharge: false }

/** A cost the owner paid privately for the company, as profit and loss counts it. A pack reads them. */
export interface OwnerAdvance {
  readonly date: CivilDate
  /** Above zero. */
  readonly amount: Money
  readonly description: string
  /** A category in the operating or taxes bucket. */
  readonly category: string
  readonly family: string
  readonly bucket: Bucket
  /** Copied from its category when the advance was filed. */
  readonly ownerShare: OwnerShare | null
  /** Held by no other row of its tab. */
  readonly id: RecordId
  /** Set on a part of a shared advance, which the cash screens count in the advance's place. */
  readonly ownerPart?: OwnerPartOf<OwnerAdvance>
}

/** Costs the owner paid, oldest first, and on one day by amount, description and category. */
export function ownerAdvanceOrder(earlier: OwnerAdvance, later: OwnerAdvance): number {
  return (
    earlier.date.localeCompare(later.date) ||
    earlier.amount - later.amount ||
    naturalOrder(earlier.description, later.description) ||
    naturalOrder(earlier.category, later.category)
  )
}

/** The buckets a cost the owner paid privately may count in. */
export const ADVANCE_BUCKETS = ['operating', 'taxes'] as const satisfies readonly DefinedBucket[]

/** An advance as profit and loss counts it: a cost on its date, in its category. */
export function bookingOfAdvance(advance: OwnerAdvance): Booking {
  const booking: Booking = { date: advance.date, amount: negateMoney(advance.amount), category: advance.category, family: advance.family, bucket: advance.bucket }
  return advance.ownerPart === undefined ? booking : { ...booking, ownerPart: advance.ownerPart }
}

/** Why a stored record was left out or is doubted, with what names it for a person. */
export interface RecordProblem {
  /** Null when the record lacks its key or id. */
  readonly id: RecordId | null
  /** Such as an invoice's number or an asset's name. */
  readonly label: string
  readonly reason: string
}

/** A record the reader could not turn into a fact, or doubts, kept so the screen can say what was left out. */
export interface WorkbookProblem extends RecordProblem {
  readonly tab:
    | 'ledger'
    | 'categories'
    | 'accounts'
    | 'settings'
    | 'rules'
    | 'invoices'
    | 'clients'
    | 'outgoing-plan'
    | 'owner-advances'
    | 'assets'
    | 'grants'
    | 'year-end'
    | 'plan'
    | 'scenarios'
    | 'splits'
    | 'dismissed'
}

/** A tab's record problems as the workbook lists them. */
export function tabProblems(tab: WorkbookProblem['tab'], problems: readonly RecordProblem[]): WorkbookProblem[] {
  return problems.map((problem) => ({ tab, ...problem }))
}

export interface Workbook {
  /** The Google spreadsheet id, or the id of the workbook kept in this browser. */
  readonly id: string
  readonly source: WorkbookSource
  readonly title: string
  /** ISO timestamp of the read this copy came from, or of the last change kept in this browser. */
  readonly syncedAt: string
  /** In the order the tab holds them, which the app keeps newest first for a person reading the Sheet. `sequence` gives the booking order. */
  readonly transactions: readonly Transaction[]
  readonly categories: readonly Category[]
  readonly accounts: readonly Account[]
  /** Every rule the `rules` tab could read, disabled ones included, in the order they are tried. */
  readonly rules: readonly Rule[]
  /** In the order the tab holds them. */
  readonly invoices: readonly Invoice[]
  readonly clients: readonly Client[]
  /** What is to be invoiced, in the order the tab holds it. */
  readonly billingPlan: readonly BillingItem[]
  /** The costs the owner paid privately, which a pack hands core, in the order its tab holds them. */
  readonly ownerAdvances: readonly OwnerAdvance[]
  /**
   * The bank rows split into parts on the `splits` tab, each split once the tab's guards pass. The
   * screens count a split row through its parts, and the ledger and its readers keep the row whole.
   */
  readonly splits: readonly LedgerSplit[]
  /** The ledger rows a pack keeps whole, by record id, each with why in the pack's words. */
  readonly rowsKeptWhole: ReadonlyMap<RecordId, string>
  /** The suggestions on Review a person dismissed, in the order the tab holds them. */
  readonly dismissals: readonly Dismissal[]
  readonly settings: Settings
  /** Each pack's part, by its key's name, which `packPart` reads. */
  readonly packParts: Readonly<Record<string, unknown>>
  readonly problems: readonly WorkbookProblem[]
}

/** The day of the newest transaction, or null when the ledger holds none. */
export function newestBookingOf(transactions: readonly Transaction[]): CivilDate | null {
  return transactions.reduce<CivilDate | null>((newest, transaction) => (newest === null || transaction.date > newest ? transaction.date : newest), null)
}

/** The complete-month window of the whole ledger, or null when it holds no transaction. */
export function ledgerWindowOf(transactions: readonly Transaction[]): LedgerWindow | null {
  if (transactions.length === 0) {
    return null
  }
  let earliest = transactions[0].date
  let newest = earliest
  for (const transaction of transactions) {
    if (transaction.date < earliest) {
      earliest = transaction.date
    }
    if (transaction.date > newest) {
      newest = transaction.date
    }
  }
  return anchorWindow(earliest, newest)
}
