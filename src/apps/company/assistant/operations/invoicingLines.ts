import { words } from './invoicingWords'
import { words as billingWords } from '../../billingPlan/presentation/words'
import { words as receivablesWords } from '../../receivables/presentation/words'
import { moneyFormatOf } from '../../settings/domain/settings'
import { words as settingsWords } from '../../settings/presentation/words'
import type { BillingItem } from '../../workbook/domain/billingPlan'
import type { ClientRecord } from '../../workbook/domain/clientsReading'
import { BILLING_RECORDS, CLIENT_RECORDS, INVOICE_RECORDS } from '../../workbook/domain/coreKinds'
import type { Invoice, Workbook } from '../../workbook/domain/workbook'
import type { ProposalDescriber, ProposedRecord } from '../../../../shared/app/proposalGroups'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import type { RecordKind } from '../../../../shared/storage/domain/recordKind'

const FIELD_NAMES: Readonly<Record<string, string>> = {
  number: receivablesWords.dialog.number,
  client: receivablesWords.dialog.client,
  item: receivablesWords.dialog.item,
  amount: receivablesWords.dialog.amount,
  issued: receivablesWords.dialog.issued,
  due: receivablesWords.dialog.due,
  date: billingWords.dialog.billableFrom,
  description: billingWords.dialog.description,
  slug: settingsWords.clientColumns.client,
  name: settingsWords.clientColumns.name,
  ibans: settingsWords.clientColumns.iban,
  ...words.fields,
}

function isKind<R>(kind: RecordKind<unknown>, of: RecordKind<R>, record: ProposedRecord): record is ProposedRecord & R {
  return kind.name === of.name && typeof record === 'object'
}

/** The kinds the describer below reads: invoices, billing plan rows and clients. */
export const INVOICING_KINDS: ReadonlySet<string> = new Set([INVOICE_RECORDS.name, BILLING_RECORDS.name, CLIENT_RECORDS.name])

/** A client's invoice details as one line, each filled one in turn. */
function invoicingText({ invoicing }: ClientRecord): string | null {
  const parts = [invoicing.address, invoicing.country, invoicing.taxId, invoicing.invoiceMail, invoicing.mailLanguage, invoicing.reverseCharge ? words.reverseCharge : ''].filter((part) => part !== '')
  return parts.length === 0 ? null : parts.join(', ')
}

/** How a card reads the invoices register, the billing plan and the clients, in the words of the invoicing screens. */
export function invoicingDescriber(workbook: Workbook): ProposalDescriber {
  const money = moneyFormatOf(workbook.settings)
  const clientName = (slug: unknown): string | null => {
    const client = workbook.clients.find((candidate) => candidate.slug === slug)
    return client === undefined ? (typeof slug === 'string' ? slug : null) : client.name || client.slug
  }
  return {
    keptByKuna: new Set(['id']),
    fieldName: (field) => FIELD_NAMES[field] ?? field,
    shown(kind, field, record) {
      const value = record[field]
      if (value === null || value === undefined || value === '') return null
      if (isKind<Invoice | BillingItem>(kind, INVOICE_RECORDS, record) || isKind<Invoice | BillingItem>(kind, BILLING_RECORDS, record)) {
        if (field === 'amount') return formatMoney(record.amount, 'negative', money)
        if (field === 'client') return clientName(record.client)
        if (field === 'issued' || field === 'due' || field === 'date') return dayLabel(value as Invoice['issued'])
        if (field === 'deliveryPeriod' && isKind(kind, INVOICE_RECORDS, record) && record.deliveryPeriod !== null)
          return `${dayLabel(record.deliveryPeriod.from)} – ${dayLabel(record.deliveryPeriod.to)}`
      }
      if (isKind(kind, CLIENT_RECORDS, record)) {
        if (field === 'ibans') return record.ibans.join(', ') || null
        if (field === 'invoicing') return invoicingText(record)
      }
      return String(value)
    },
    label(kind, record, fallback) {
      if (isKind(kind, INVOICE_RECORDS, record)) return `${record.number}, ${clientName(record.client) ?? record.client}`
      if (isKind(kind, BILLING_RECORDS, record)) return billingWords.dialog.named(record.item, clientName(record.client) ?? record.client, dayLabel(record.date))
      if (isKind(kind, CLIENT_RECORDS, record)) return record.name || record.slug
      return fallback
    },
    warns(kind, field, after, before) {
      if (after === null || !isKind(kind, CLIENT_RECORDS, after)) return false
      const mailBefore = before !== null && isKind(kind, CLIENT_RECORDS, before) ? before.invoicing.invoiceMail : ''
      return field === 'ibans' || (field === 'invoicing' && after.invoicing.invoiceMail !== '' && after.invoicing.invoiceMail !== mailBefore)
    },
  }
}
