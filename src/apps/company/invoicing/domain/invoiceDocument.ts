import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { DateRange } from '../../../../shared/calendar/dateRange'
import type { Money } from '../../../../shared/money/money'
import type { InvoicingTerms } from '../../settings/domain/settings'
import type { Client } from '../../workbook/domain/workbook'
import type { InvoiceLine } from './invoiceLine'

/** Who the invoice is for, as it prints them. */
export interface InvoiceRecipient {
  readonly name: string
  readonly address: string
  readonly country: string
  readonly taxId: string
}

/** Everything an invoice prints. */
export interface InvoiceDocument {
  readonly number: string
  readonly issued: CivilDate
  readonly due: CivilDate
  readonly deliveryPeriod: DateRange
  readonly issuer: InvoicingTerms
  readonly recipient: InvoiceRecipient
  readonly lines: readonly InvoiceLine[]
  readonly total: Money
  /** An ISO 4217 code, printed after each amount. */
  readonly currency: string
  /** A BCP 47 tag for the amounts' grouping and decimal mark. */
  readonly numberLocale: string
}

export function recipientOf(client: Client): InvoiceRecipient {
  return { name: client.name || client.slug, address: client.invoicing.address, country: client.invoicing.country, taxId: client.invoicing.taxId }
}

/** The invoice terms an invoice cannot do without, in the order a sentence of missing ones lists them. */
export const REQUIRED_ISSUER = ['name', 'address', 'oib', 'iban', 'place', 'signatory'] as const satisfies readonly (keyof InvoicingTerms)[]

export type IssuerDetail = (typeof REQUIRED_ISSUER)[number]

/** What keeps the app from making an invoice that the invoice terms or the client's details fix. */
export type InvoiceProblem =
  | { readonly kind: 'terms-missing'; readonly missing: readonly IssuerDetail[] }
  | { readonly kind: 'no-address'; readonly client: string }
  | { readonly kind: 'not-reverse-charge'; readonly client: string }

/** What keeps the app from making an invoice for the client that the invoice terms or the client's details fix. Empty when nothing does. */
export function invoiceProblems(issuer: InvoicingTerms, client: Client | null): InvoiceProblem[] {
  const problems: InvoiceProblem[] = []
  const missing = REQUIRED_ISSUER.filter((field) => issuer[field].trim() === '')
  if (missing.length > 0) {
    problems.push({ kind: 'terms-missing', missing })
  }
  if (client !== null) {
    if (client.invoicing.address === '') {
      problems.push({ kind: 'no-address', client: client.name || client.slug })
    }
    if (!client.invoicing.reverseCharge) {
      problems.push({ kind: 'not-reverse-charge', client: client.name || client.slug })
    }
  }
  return problems
}
