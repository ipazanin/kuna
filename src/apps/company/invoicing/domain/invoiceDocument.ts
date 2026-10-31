import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { DateRange } from '../../../../shared/calendar/dateRange'
import type { Money } from '../../../../shared/money/money'
import type { InvoicingTerms } from '../../settings/domain/settings'
import type { Client } from '../../workbook/domain/workbook'
import { lineProblems } from './invoiceLines'
import type { InvoiceLine } from './invoiceLines'
import { words } from './words'

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

/** The settings an invoice cannot do without, with the words the invoice terms give them. */
export const REQUIRED_ISSUER: readonly (readonly [keyof InvoicingTerms, string])[] = [
  ['name', words.issuer.name],
  ['address', words.issuer.address],
  ['vatId', words.issuer.vatId],
  ['iban', words.issuer.iban],
  ['place', words.issuer.place],
  ['signatory', words.issuer.signatory],
]

/** What keeps the app from making an invoice for the client, each a sentence. Empty when it can. */
export function invoiceProblems(issuer: InvoicingTerms, client: Client | null, lines: readonly InvoiceLine[]): string[] {
  const problems: string[] = []
  const missing = REQUIRED_ISSUER.filter(([field]) => issuer[field].trim() === '').map(([, part]) => part)
  if (missing.length > 0) {
    problems.push(words.termsNeed(missing))
  }
  if (client === null) {
    problems.push(words.chooseClient)
  } else {
    if (client.invoicing.address === '') {
      problems.push(words.needsAddress(client.name || client.slug))
    }
    if (!client.invoicing.reverseCharge) {
      problems.push(words.reverseChargeOnly(client.name || client.slug))
    }
  }
  problems.push(...lineProblems(lines))
  return problems
}
