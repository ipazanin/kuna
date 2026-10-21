import type { CivilDate } from '../../../shared/calendar/civilDate'
import type { DateRange } from '../../../shared/calendar/dateRange'
import { anchorWindow } from '../../../shared/calendar/ledgerWindow'
import type { LedgerWindow } from '../../../shared/calendar/ledgerWindow'
import { negateMoney } from '../../../shared/money/money'
import type { Money } from '../../../shared/money/money'
import type { Rule } from '../../rules/domain/rule'
import type { Settings } from '../../settings/domain/settings'
import type { Asset } from './assets'
import type { BillingItem } from './billingPlan'
import type { Bucket, DefinedBucket } from './bucket'
import type { Grant } from './grants'
import type { OwnerPayScenario } from './ownerPayScenarios'
import type { PlanLine } from './plan'
import type { VatTreatment } from './vatTreatment'
import type { LedgerSplit } from './splits'
import type { YearEndLine } from './yearEnd'

export interface Category {
  readonly slug: string
  /** What the screens call it, when the tab gives a name. The slug stays the identity. */
  readonly label?: string
  readonly family: string
  readonly bucket: DefinedBucket
  readonly colour: string
  /** What code may select the category for, such as `revenue` or `watched`. Lower case. */
  readonly roles: readonly string[]
  /** How a purchase in it splits into cost and VAT. */
  readonly vat: VatTreatment
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
   * Booking order across the whole ledger, oldest first. It comes from the tab's own order, which
   * is newest first with the last booking of a day on top, so the highest sequence on an account's
   * latest date is its closing balance.
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
  /** The 1-based row on the tab when it was read. */
  readonly sheetRow: number
  /** Set on a part of a split bank row, which the screens count in the row's place. */
  readonly split?: SplitPartOf
}

/** Where a part of a split row comes from: the bank row as booked, and the part's place among its parts. */
export interface SplitPartOf {
  readonly whole: Transaction
  /** From 0, in the order of the splits tab. */
  readonly index: number
  readonly count: number
  readonly note: string
  /** The part's row on the splits tab. */
  readonly sheetRow: number
}

/** What profit and loss counts of a row: a bank transaction, or a cost the owner paid privately. */
export type Booking = Pick<Transaction, 'date' | 'amount' | 'category' | 'family' | 'bucket'>

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
  /** The 1-based row on the tab, which is also the order the invoices were written in. */
  readonly sheetRow: number
}

/** A client from the `clients` tab, which holds one row per IBAN. */
export interface Client {
  readonly slug: string
  /** Blank when no row of the client names it. */
  readonly name: string
  /** Normalised. A payment from one of them is the client's. */
  readonly ibans: readonly string[]
  readonly invoicing: ClientInvoicing
}

/** What an invoice to the client prints and where its mail goes, each from the first of the client's rows that gives it. Blank when none does. */
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

/** A row of the `owner-advances` tab: a cost the owner paid privately for the company. */
export interface OwnerAdvance {
  readonly date: CivilDate
  /** Above zero. */
  readonly amount: Money
  readonly description: string
  /** A category in the operating or taxes bucket. */
  readonly category: string
  readonly family: string
  readonly bucket: Bucket
  readonly sheetRow: number
}

/** The buckets a cost the owner paid privately may count in. */
export const ADVANCE_BUCKETS = ['operating', 'taxes'] as const satisfies readonly DefinedBucket[]

/** An advance as profit and loss counts it: a cost on its date, in its category. */
export function bookingOfAdvance(advance: OwnerAdvance): Booking {
  return { date: advance.date, amount: negateMoney(advance.amount), category: advance.category, family: advance.family, bucket: advance.bucket }
}

/** A row the reader could not turn into a fact, kept so the screen can say what was left out. */
export interface WorkbookProblem {
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
  readonly sheetRow: number
  readonly reason: string
}

export interface Workbook {
  /** The Google spreadsheet id, or the id of the workbook kept in this browser. */
  readonly id: string
  readonly source: WorkbookSource
  readonly title: string
  /** The `ledger` tab's numeric id, for links to its rows. Null for a copy cached without it. */
  readonly ledgerSheetId: number | null
  /** ISO timestamp of the read this copy came from, or of the last change kept in this browser. */
  readonly syncedAt: string
  /** Newest first, as the tab holds them. */
  readonly transactions: readonly Transaction[]
  readonly categories: readonly Category[]
  readonly accounts: readonly Account[]
  /** Every rule the `rules` tab could read, disabled ones included, in the order they are tried. */
  readonly rules: readonly Rule[]
  /** In the order the tab holds them. */
  readonly invoices: readonly Invoice[]
  readonly clients: readonly Client[]
  /** False for a Google Sheet without a `clients` tab, where the Apps Script refuses a rule that tests counterparty_is_client. */
  readonly hasClientsTab: boolean
  /** What is to be invoiced, in the order the tab holds it. */
  readonly billingPlan: readonly BillingItem[]
  /** In the order the tab holds them. */
  readonly ownerAdvances: readonly OwnerAdvance[]
  /**
   * The bank rows split into parts on the `splits` tab, each split once the tab's guards pass. The
   * screens count a split row through its parts, and the ledger and its readers keep the row whole.
   */
  readonly splits: readonly LedgerSplit[]
  /** In the order the tab holds them. */
  readonly assets: readonly Asset[]
  /** In the order the tab holds them. */
  readonly grants: readonly Grant[]
  /** The accountant's figures, in the order the tab holds them. */
  readonly yearEndLines: readonly YearEndLine[]
  /** In the order the tab holds them. */
  readonly planLines: readonly PlanLine[]
  /** In the order their first rows appear on the tab. */
  readonly payScenarios: readonly OwnerPayScenario[]
  readonly settings: Settings
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
