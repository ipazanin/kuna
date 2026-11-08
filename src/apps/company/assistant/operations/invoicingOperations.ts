import { fieldsOf } from './companyCard'
import type { CompanyCard, CompanyOperationSet } from './companyCard'
import { BILLING_WRITES, newBillingItem } from '../../billingPlan/application/billingWrites'
import { fillRestOfYear } from '../../billingPlan/domain/fillRestOfYear'
import { INVOICE_WRITES } from '../../receivables/application/invoiceWrites'
import { invoiceDatesProblems } from '../../receivables/domain/invoiceGuards'
import { CLIENT_WRITES } from '../../settings/application/namedRecordWrites'
import { CLIENT_RECORDS, BILLING_RECORDS, INVOICE_RECORDS } from '../../workbook/domain/coreKinds'
import { clientOfFields } from '../../workbook/domain/clientsReading'
import type { ClientRecord } from '../../workbook/domain/clientsReading'
import { invoiceIdOf } from '../../workbook/domain/invoicesReading'
import type { Invoice } from '../../workbook/domain/workbook'
import { newestBookingOf } from '../../workbook/domain/workbook'
import type { StrictSchema } from '../../../../shared/ai/domain/strictSchema'
import type { AssistantOperation, ProposalStep } from '../../../../shared/app/assistantOperations'
import { FLAG_OR_NULL, NUMBER, NUMBER_OR_NULL, TEXT, TEXT_OR_NULL, dayOf, inputOf } from '../../../../shared/app/operationInput'
import { StepRefused } from '../../../../shared/app/proposedWrites'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { moneyFromAmount } from '../../../../shared/money/money'
import type { ReadRecord, RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import { refusalOr, storedFieldOfValue } from '../../../../shared/storage/domain/storedFields'
import type { StoredField, StoredFields } from '../../../../shared/storage/domain/storedFields'

const DAY_OR_NULL: StrictSchema = { type: ['string', 'null'], description: 'A day such as 2026-10-31, "" for none, or null to leave it.' }

const MAKE_ON_SCREEN =
  'An invoice made on the Invoices tab is drawn as a PDF, filed on Drive and saved as a Gmail draft, which only the person does there: link /company/invoicing?tab=invoices with make set to the client, or reexport set to the invoice, and say what to check.'

/** Every change the chat can propose to the invoices register, the billing plan and the clients. Making an invoice is a link, never a card. */
const OPERATIONS: readonly AssistantOperation[] = [
  {
    name: 'add-invoice',
    about: `Adds a row to the invoices register for an invoice made elsewhere. The amount is the total, above zero. ${MAKE_ON_SCREEN}`,
    input: inputOf({ number: TEXT, client: TEXT, item: TEXT, amount: NUMBER, issued: TEXT, due: DAY_OR_NULL, periodFrom: DAY_OR_NULL, periodTo: DAY_OR_NULL }),
    refs: { client: CLIENT_RECORDS.name },
    creates: null,
    alone: false,
    example: { number: '99-1-26', client: 'client', item: 'Consulting', amount: 1200, issued: '2026-10-31', due: '2026-11-15', periodFrom: '2026-10-01', periodTo: '2026-10-31' },
  },
  {
    name: 'change-invoice',
    about: `Fixes a row of the invoices register. Null leaves a field as it is, and "" clears a due day or the work period. Its PDF on Drive stays as it was. ${MAKE_ON_SCREEN}`,
    input: inputOf({
      invoice: TEXT,
      number: TEXT_OR_NULL,
      client: TEXT_OR_NULL,
      item: TEXT_OR_NULL,
      amount: NUMBER_OR_NULL,
      issued: TEXT_OR_NULL,
      due: DAY_OR_NULL,
      periodFrom: DAY_OR_NULL,
      periodTo: DAY_OR_NULL,
    }),
    refs: { invoice: INVOICE_RECORDS.name, client: CLIENT_RECORDS.name },
    creates: null,
    alone: false,
    example: { invoice: 'invoice', number: null, client: null, item: 'Consulting, corrected', amount: null, issued: null, due: null, periodFrom: null, periodTo: null },
  },
  {
    name: 'delete-invoice',
    about: 'Deletes a row of the invoices register. Its PDF on Drive and any mail stay.',
    input: inputOf({ invoice: TEXT }),
    refs: { invoice: INVOICE_RECORDS.name },
    creates: null,
    alone: false,
    example: { invoice: 'invoice' },
  },
  {
    name: 'add-billing-item',
    about:
      'Adds a row to the billing plan: something to invoice a client from the day it becomes billable, such as a monthly fee on the last day of the worked month. Rows of one kind share their item text.',
    input: inputOf({ item: TEXT, date: TEXT, amount: NUMBER, client: TEXT, description: TEXT }),
    refs: { client: CLIENT_RECORDS.name },
    creates: null,
    alone: false,
    example: { item: 'Hotel', date: '2026-11-12', amount: 180, client: 'client', description: 'Hotel for the November workshop' },
  },
  {
    name: 'change-billing-item',
    about: 'Fixes a row of the billing plan. Null leaves a field as it is.',
    input: inputOf({ row: TEXT, item: TEXT_OR_NULL, date: TEXT_OR_NULL, amount: NUMBER_OR_NULL, client: TEXT_OR_NULL, description: TEXT_OR_NULL }),
    refs: { row: BILLING_RECORDS.name, client: CLIENT_RECORDS.name },
    creates: null,
    alone: false,
    example: { row: 'billing-item', item: null, date: null, amount: 7300, client: null, description: null },
  },
  {
    name: 'delete-billing-item',
    about: 'Deletes a row of the billing plan.',
    input: inputOf({ row: TEXT }),
    refs: { row: BILLING_RECORDS.name },
    creates: null,
    alone: false,
    example: { row: 'billing-item' },
  },
  {
    name: 'fill-billing-year',
    about:
      "Fills the billing plan as the Plan tab's Fill the rest of the year does: the monthly fee and the subscriptions of the billing terms, for the billing client, on the last day of each month from the newest booking's month to December of the year, skipping a month that has the item. A year still to come fills from January.",
    input: inputOf({ year: NUMBER }),
    refs: {},
    creates: null,
    alone: false,
    example: { year: 2026 },
  },
  {
    name: 'add-client',
    about:
      'Adds a client. client is its short name in lower case, such as northwind, which invoices and plan rows name. ibans lists the accounts its payments come from, comma separated, at least one. Fill an IBAN or a mail address only if you read it or the person gave it: the card warns on it. mailLanguage is a language tag such as en or hr, or "". reverseCharge is yes when the client accounts for the VAT.',
    input: inputOf({ client: TEXT, name: TEXT, ibans: TEXT, address: TEXT, country: TEXT, taxId: TEXT, invoiceMail: TEXT, mailLanguage: TEXT, reverseCharge: { type: 'string', enum: ['yes', 'no'] } }),
    refs: {},
    creates: CLIENT_RECORDS.name,
    alone: false,
    example: {
      client: 'acme',
      name: 'Acme Ltd',
      ibans: 'HR1210010051863000160',
      address: '2 Example Street, Zagreb',
      country: 'Croatia',
      taxId: '',
      invoiceMail: '',
      mailLanguage: 'hr',
      reverseCharge: 'no',
    },
  },
  {
    name: 'change-client',
    about:
      'Fixes a client. A new short name is refused while invoices, plan rows or the billing terms name the client. ibans replaces the whole list. The card warns on IBANs and mail. Null leaves a field as it is, and "" clears a text.',
    input: inputOf({
      client: TEXT,
      shortName: TEXT_OR_NULL,
      name: TEXT_OR_NULL,
      ibans: TEXT_OR_NULL,
      address: TEXT_OR_NULL,
      country: TEXT_OR_NULL,
      taxId: TEXT_OR_NULL,
      invoiceMail: TEXT_OR_NULL,
      mailLanguage: TEXT_OR_NULL,
      reverseCharge: FLAG_OR_NULL,
    }),
    refs: { client: CLIENT_RECORDS.name },
    creates: null,
    alone: false,
    example: { client: 'client', shortName: null, name: 'Renamed Ltd', ibans: null, address: null, country: null, taxId: null, invoiceMail: null, mailLanguage: null, reverseCharge: null },
  },
  {
    name: 'delete-client',
    about: 'Deletes a client, refused while invoices, plan rows or the billing terms name it.',
    input: inputOf({ client: TEXT }),
    refs: { client: CLIENT_RECORDS.name },
    creates: null,
    alone: false,
    example: { client: 'client-unused' },
  },
]

/** A day, null to keep the one held, or blank for none. */
function optionalDay(text: string | null, kept: CivilDate | null): CivilDate | null {
  if (text === null) return kept
  return text.trim() === '' ? null : dayOf(text.trim())
}

/** An invoice whose dates keep the rules the invoice dialog checks. */
function checkedInvoice(invoice: Invoice): Invoice {
  const problems = invoiceDatesProblems(invoice.issued, invoice.due, invoice.deliveryPeriod?.from ?? null, invoice.deliveryPeriod?.to ?? null)
  if (problems.due === 'before-issue') throw new StepRefused('The due day is not before the issue day.')
  if (invoice.number.trim() === '') throw new StepRefused('An invoice has a number.')
  return invoice
}

/** The work period a step gives: both days, or "" for none, or null for each to keep the one held. */
function periodOf(from: string | null, to: string | null, kept: Invoice['deliveryPeriod']): Invoice['deliveryPeriod'] {
  const first = optionalDay(from, kept?.from ?? null)
  const last = optionalDay(to, kept?.to ?? null)
  const problems = invoiceDatesProblems(null, null, first, last)
  if (problems.period === 'one-end') throw new StepRefused('A work period has both days, or neither.')
  if (problems.period === 'order') throw new StepRefused('A work period ends after it starts.')
  return first === null || last === null ? null : { from: first, to: last }
}

/** The client's fields as the clients editor writes them: a blank field is absent, and reverse charge is true or absent. */
const CLIENT_FIELDS: Readonly<Record<string, string>> = {
  shortName: 'client',
  name: 'name',
  ibans: 'iban',
  address: 'address',
  country: 'country',
  taxId: 'tax_id',
  invoiceMail: 'invoice_mail',
  mailLanguage: 'mail_language',
}

function clientFieldsOf(stored: StoredFields, input: Readonly<Record<string, unknown>>): StoredFields {
  const fields: Record<string, StoredField> = { ...stored }
  for (const [name, column] of Object.entries(CLIENT_FIELDS)) {
    const value = input[name]
    if (typeof value !== 'string') continue
    const text = column === 'client' ? value.trim().toLowerCase() : value.trim()
    if (text === '') delete fields[column]
    else fields[column] = storedFieldOfValue(text)
  }
  const reverse = input['reverseCharge']
  if (reverse === 'yes') fields['reverse_charge'] = storedFieldOfValue(true)
  else if (reverse === 'no') delete fields['reverse_charge']
  return fields
}

/** A client as the clients editor makes one from its fields, refused for the reasons the editor gives. */
function clientMadeOf(fields: StoredFields): ClientRecord {
  const made = refusalOr(() => clientOfFields(fields))
  if ('refused' in made) throw new StepRefused(made.refused)
  return made.made
}

/** The record a step names, as the card's earlier steps left the books, refused once it is gone. */
function heldRecord<R>(read: RecordsRead<R>, matches: (stored: ReadRecord<R>) => boolean, gone: string): ReadRecord<R> {
  const stored = read.records.find(matches)
  if (stored === undefined) throw new StepRefused(gone)
  return stored
}

/** Plans one step through the write functions the invoicing screens use, on the books as the card's earlier steps left them. */
function planStep(card: CompanyCard, step: ProposalStep): void {
  const { operation, input } = step
  const field = fieldsOf(step)
  const records = card.records()
  const { unit, idOf, workbook } = card
  const invoiceOf = (value: unknown) => heldRecord(records.invoices, (stored) => stored.id === idOf(value), 'That invoice is no longer in the register.')
  const billingOf = (value: unknown) => heldRecord(records['outgoing-plan'], (stored) => stored.id === idOf(value), 'That plan row is no longer in the billing plan.')
  const clientOf = (value: unknown) => heldRecord(records.clients, (stored) => stored.record.slug === idOf(value), 'That client is no longer on the clients tab.')
  switch (operation) {
    case 'add-invoice': {
      const client = idOf(field['client'])
      const number = (field['number'] as string).trim()
      const issued = dayOf(field['issued'])
      const invoice: Invoice = {
        number,
        client,
        item: (field['item'] as string).trim(),
        amount: moneyFromAmount(field['amount']),
        issued,
        due: optionalDay(field['due'], null),
        deliveryPeriod: periodOf(field['periodFrom'], field['periodTo'], null),
        id: invoiceIdOf({ client, number }),
      }
      unit.of(INVOICE_WRITES).add(checkedInvoice(invoice))
      return
    }
    case 'change-invoice': {
      const before = invoiceOf(field['invoice']).record
      const number = (field['number'] as string | null)?.trim() ?? before.number
      const client = field['client'] === null ? before.client : idOf(field['client'])
      const after: Invoice = {
        number,
        client,
        item: (field['item'] as string | null)?.trim() ?? before.item,
        amount: field['amount'] === null ? before.amount : moneyFromAmount(field['amount']),
        issued: field['issued'] === null ? before.issued : dayOf(field['issued']),
        due: optionalDay(field['due'], before.due),
        deliveryPeriod: periodOf(field['periodFrom'], field['periodTo'], before.deliveryPeriod),
        id: invoiceIdOf({ client, number }),
      }
      unit.of(INVOICE_WRITES).change(before, checkedInvoice(after))
      return
    }
    case 'delete-invoice':
      unit.of(INVOICE_WRITES).remove(invoiceOf(field['invoice']).record)
      return
    case 'add-billing-item':
      unit
        .of(BILLING_WRITES)
        .add(newBillingItem({ item: field['item'], date: dayOf(field['date']), amount: moneyFromAmount(field['amount']), client: idOf(field['client']), description: field['description'] }))
      return
    case 'change-billing-item': {
      const before = billingOf(field['row']).record
      const typed = newBillingItem({
        item: (field['item'] as string | null) ?? before.item,
        date: field['date'] === null ? before.date : dayOf(field['date']),
        amount: field['amount'] === null ? before.amount : moneyFromAmount(field['amount']),
        client: field['client'] === null ? before.client : idOf(field['client']),
        description: (field['description'] as string | null) ?? before.description,
      })
      unit.of(BILLING_WRITES).change(before, { ...typed, id: before.id })
      return
    }
    case 'delete-billing-item':
      unit.of(BILLING_WRITES).remove(billingOf(field['row']).record)
      return
    case 'fill-billing-year': {
      const asOf = newestBookingOf(workbook.transactions)
      if (asOf === null) throw new StepRefused('The ledger has no booking yet, so the plan has no month to fill from.')
      const fill = fillRestOfYear(workbook.billingPlan, workbook.settings.billing, asOf, field['year'])
      if (fill.kind === 'refused') throw new StepRefused(`${fill.reason} The billing terms are on /company/invoicing?tab=clients.`)
      fill.rows.forEach((row) => unit.of(BILLING_WRITES).add(newBillingItem(row)))
      return
    }
    case 'add-client': {
      const client = clientMadeOf(clientFieldsOf({}, { ...input, shortName: field['client'] }))
      unit.of(CLIENT_WRITES).add(client)
      card.made(step.as, client.slug)
      return
    }
    case 'change-client': {
      const before = clientOf(field['client'])
      unit.of(CLIENT_WRITES).change(before.record, clientMadeOf(clientFieldsOf(before.fields, input)))
      return
    }
    case 'delete-client':
      unit.of(CLIENT_WRITES).remove(clientOf(field['client']).record)
      return
    default:
      throw new StepRefused('There is no such operation.')
  }
}

/** What the chat can do to the invoices register, the billing plan and the clients. The invoicing terms are settings, which set-setting sets. */
export const INVOICING_OPERATIONS: CompanyOperationSet = { operations: OPERATIONS, planStep }
