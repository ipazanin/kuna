import { fieldsOf } from './companyCard'
import type { CompanyCard, CompanyOperationSet } from './companyCard'
import { BILLING_WRITES, newBillingItem } from '../../billingPlan/application/billingWrites'
import { fillRestOfYear } from '../../billingPlan/domain/fillRestOfYear'
import { removeInvoice } from '../../receivables/application/invoiceWrites'
import { writeInvoice } from '../../receivables/application/invoicePaymentWrites'
import { paymentChoices } from '../../receivables/domain/invoicePayments'
import type { PaymentChoice } from '../../receivables/domain/invoicePayments'
import { presentedWorkbook } from '../../transactions/domain/presentedWorkbook'
import { placedShares } from '../../workbook/domain/rowPayments'
import { storesItems } from '../../workbook/domain/rowItems'
import { invoiceDatesProblems } from '../../receivables/domain/invoiceGuards'
import { CLIENT_WRITES } from '../../settings/application/namedRecordWrites'
import { CLIENT_RECORDS, BILLING_RECORDS, INVOICE_RECORDS, ITEM_RECORDS } from '../../workbook/domain/coreKinds'
import { clientFieldsWith, clientOfFields } from '../../workbook/domain/clientsReading'
import type { ClientRecord, ClientTextField } from '../../workbook/domain/clientsReading'
import { templateProblems } from '../../invoicing/domain/invoiceTemplate'
import type { InvoiceTemplateLine } from '../../invoicing/domain/invoiceTemplate'
import { en as invoicingEn } from '../../invoicing/domain/words'
import { invoiceIdOf } from '../../workbook/domain/invoicesReading'
import type { Invoice } from '../../workbook/domain/workbook'
import type { CompanyBooks } from '../../workbook/domain/readWorkbook'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { newestBookingOf } from '../../workbook/domain/workbook'
import type { StrictSchema } from '../../../../shared/ai/domain/strictSchema'
import type { AssistantOperation, ProposalStep } from '../../../../shared/app/assistantOperations'
import { FLAG_OR_NULL, NUMBER, NUMBER_OR_NULL, TEXT, TEXT_OR_NULL, dayOf, inputOf } from '../../../../shared/app/operationInput'
import { StepRefused } from '../../../../shared/app/proposedWrites'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { moneyFromAmount } from '../../../../shared/money/money'
import type { ReadRecord, RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import { refusalOr } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'

const DAY_OR_NULL: StrictSchema = { type: ['string', 'null'], description: 'A day such as 2026-10-31, "" for none, or null to leave it.' }

const MAKE_ON_SCREEN =
  'An invoice made on the Invoices tab is drawn as a PDF, filed on Drive and saved as a Gmail draft while switch-mail-drafts has drafts on. Only the person makes it there: link /company/invoicing?tab=invoices with make set to the client, or reexport set to the invoice, and say what to check.'

/** What the invoice operations say of the payments that pay an invoice. */
const PAID_BY =
  'paidBy lists the items of revenue credits that pay it, in books that keep items: one the invoice holds already, or one no invoice holds from its client or from an account no client names. One larger than what is still owed gives the part the invoice needs to an item of its own. Books from before items take an empty list, since they match client payments by themselves.'

/** What the invoice operations say of the plan items behind an invoice's lines. */
const PLAN_ITEMS =
  'planItems names each line of the invoice with the billing plan items it summed in brackets, such as "Software development (Development); Maintenance (Hosting, Support)", or "" for none.'

const PAID_BY_ITEMS = { type: 'array', items: inputOf({ item: TEXT }) } as const satisfies StrictSchema

const INVOICE_LINE = inputOf({ text: TEXT, items: { type: 'array', items: TEXT } })

/** What the client operations say of a client's own invoice lines. */
const INVOICE_LINES =
  "lines are the client's own invoice lines, in order: each line's text, which may name {month} for the issue month in the client's mail language, and the billing plan items it sums, written exactly as the plan rows write them. The last line also sums every plan item no line names, so every line but the last names at least one item, and no item is on two lines. An empty list makes one line per open plan row."

/** Every change the chat can propose to the invoices register, the billing plan and the clients. Making an invoice is a link, never a card. */
const OPERATIONS: readonly AssistantOperation[] = [
  {
    name: 'add-invoice',
    about: `Adds a row to the invoices register for an invoice made elsewhere. The amount is the total, above zero. ${PLAN_ITEMS} ${PAID_BY} ${MAKE_ON_SCREEN}`,
    input: inputOf({
      number: TEXT,
      client: TEXT,
      item: TEXT,
      planItems: TEXT,
      amount: NUMBER,
      issued: TEXT,
      due: DAY_OR_NULL,
      periodFrom: DAY_OR_NULL,
      periodTo: DAY_OR_NULL,
      paidBy: PAID_BY_ITEMS,
    }),
    refs: { client: CLIENT_RECORDS.name, 'paidBy.item': ITEM_RECORDS.name },
    creates: null,
    alone: false,
    example: {
      number: '99-1-26',
      client: 'client',
      item: 'Consulting',
      planItems: '',
      amount: 1200,
      issued: '2026-10-31',
      due: '2026-11-15',
      periodFrom: '2026-10-01',
      periodTo: '2026-10-31',
      paidBy: [],
    },
  },
  {
    name: 'change-invoice',
    about: `Fixes a row of the invoices register. Null leaves a field as it is, and "" clears a due day or the work period. Its PDF on Drive stays as it was. ${PLAN_ITEMS} ${PAID_BY} paid keep leaves the payments that pay it as they are and takes an empty paidBy, and set puts paidBy in their place. ${MAKE_ON_SCREEN}`,
    input: inputOf({
      invoice: TEXT,
      number: TEXT_OR_NULL,
      client: TEXT_OR_NULL,
      item: TEXT_OR_NULL,
      planItems: TEXT_OR_NULL,
      amount: NUMBER_OR_NULL,
      issued: TEXT_OR_NULL,
      due: DAY_OR_NULL,
      periodFrom: DAY_OR_NULL,
      periodTo: DAY_OR_NULL,
      paid: { type: 'string', enum: ['keep', 'set'] },
      paidBy: PAID_BY_ITEMS,
    }),
    refs: { invoice: INVOICE_RECORDS.name, client: CLIENT_RECORDS.name, 'paidBy.item': ITEM_RECORDS.name },
    creates: null,
    alone: false,
    example: {
      invoice: 'invoice',
      number: null,
      client: null,
      item: 'Consulting, corrected',
      planItems: null,
      amount: null,
      issued: null,
      due: null,
      periodFrom: null,
      periodTo: null,
      paid: 'keep',
      paidBy: [],
    },
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
    about: `Adds a client. client is its short name in lower case, such as northwind, which invoices and plan rows name. ibans lists the accounts its payments come from, comma separated, at least one. Fill an IBAN or a mail address only if you read it or the person gave it: the card warns on it. mailLanguage is a language tag such as en or hr, or "". reverseCharge is yes when the client accounts for the VAT. ${INVOICE_LINES}`,
    input: inputOf({
      client: TEXT,
      name: TEXT,
      ibans: TEXT,
      address: TEXT,
      country: TEXT,
      taxId: TEXT,
      invoiceMail: TEXT,
      mailLanguage: TEXT,
      reverseCharge: { type: 'string', enum: ['yes', 'no'] },
      lines: { type: 'array', items: INVOICE_LINE },
    }),
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
      lines: [
        { text: 'Software services for {month}', items: ['Monthly Fee'] },
        { text: 'Costs billed on', items: [] },
      ],
    },
  },
  {
    name: 'change-client',
    about: `Fixes a client. A new short name is refused while invoices, plan rows or the billing terms name the client. ibans replaces the whole list. The card warns on IBANs and mail. Null leaves a field as it is, and "" clears a text. ${INVOICE_LINES}`,
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
      lines: { type: ['array', 'null'], items: INVOICE_LINE },
    }),
    refs: { client: CLIENT_RECORDS.name },
    creates: null,
    alone: false,
    example: {
      client: 'client',
      shortName: null,
      name: 'Renamed Ltd',
      ibans: null,
      address: null,
      country: null,
      taxId: null,
      invoiceMail: null,
      mailLanguage: null,
      reverseCharge: null,
      lines: null,
    },
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

/**
 * The payments a step names as what pays the invoice, each one a person could tick under Paid by in the invoice dialog, all of an
 * item's money on offer for each item named, or null to leave them as they are, as a step that names none on a new invoice does.
 * Refused when one is not on offer or when the invoice is paid in full without one of them.
 */
function chosenPayments(
  books: CompanyBooks,
  held: RecordId | null,
  invoice: Invoice,
  named: readonly { readonly item: string }[] | null,
  idOf: (value: unknown) => string,
): readonly PaymentChoice[] | null {
  if (named === null || (held === null && named.length === 0)) return null
  if (named.length > 0 && !storesItems(books.records)) throw new StepRefused('These books are from before items and match client payments to invoices by themselves, so paidBy is an empty list.')
  const choices = paymentChoices(presentedWorkbook(books.workbook), held, invoice.client)
  const items = new Set(
    named.map(({ item }) => {
      const id = idOf(item)
      if (!choices.some((choice) => choice.item === id))
        throw new StepRefused('Each paidBy item is a revenue credit that this invoice holds already, or that no invoice holds from its client or from an account no client names.')
      return id
    }),
  )
  const chosen = choices.filter((choice) => items.has(choice.item))
  if (placedShares(invoice.amount, chosen).some((share) => share <= 0)) throw new StepRefused('The invoice is paid in full without a payment paidBy names, so leave that one out.')
  return chosen
}

/** The client's fields the chat names, by their stored names. */
const CLIENT_FIELDS: Readonly<Record<string, ClientTextField>> = {
  shortName: 'client',
  name: 'name',
  ibans: 'iban',
  address: 'address',
  country: 'country',
  taxId: 'tax_id',
  invoiceMail: 'invoice_mail',
  mailLanguage: 'mail_language',
}

/** The client's fields with what a step sets, refused for invoice lines that break a rule, as the client dialog refuses them. */
function clientFieldsOf(stored: StoredFields, input: Readonly<Record<string, unknown>>): StoredFields {
  const texts = Object.fromEntries(Object.entries(CLIENT_FIELDS).flatMap(([name, column]) => (typeof input[name] === 'string' ? [[column, input[name]]] : [])))
  const reverse = input['reverseCharge']
  const lines = Array.isArray(input['lines']) ? (input['lines'] as readonly InvoiceTemplateLine[]).map((line) => ({ text: line.text.trim(), items: line.items.map((item) => item.trim()) })) : undefined
  const problems = lines === undefined ? [] : templateProblems(lines)
  if (problems.length > 0)
    throw new StepRefused(`The invoice lines cannot be saved: ${problems.map((problem) => invoicingEn.templateLine(problem.line, invoicingEn.templateProblem(problem))).join(', ')}.`)
  return clientFieldsWith(stored, {
    texts,
    ...(reverse === 'yes' || reverse === 'no' ? { reverseCharge: reverse === 'yes' } : {}),
    ...(lines === undefined ? {} : { lines }),
  })
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
  const books = (): CompanyBooks => ({ records, workbook })
  const invoiceOf = (value: unknown) => heldRecord(records.invoices, (stored) => stored.id === idOf(value), 'That invoice is no longer in the register.')
  const billingOf = (value: unknown) => heldRecord(records['outgoing-plan'], (stored) => stored.id === idOf(value), 'That plan row is no longer in the billing plan.')
  const clientOf = (value: unknown) => heldRecord(records.clients, (stored) => stored.record.slug === idOf(value), 'That client is no longer on the clients tab.')
  switch (operation) {
    case 'add-invoice': {
      const client = idOf(field['client'])
      const number = (field['number'] as string).trim()
      const issued = dayOf(field['issued'])
      const planItems = (field['planItems'] as string).trim()
      const invoice: Invoice = {
        number,
        client,
        item: (field['item'] as string).trim(),
        ...(planItems === '' ? {} : { planItems }),
        amount: moneyFromAmount(field['amount']),
        issued,
        due: optionalDay(field['due'], null),
        deliveryPeriod: periodOf(field['periodFrom'], field['periodTo'], null),
        id: invoiceIdOf({ client, number }),
      }
      const checked = checkedInvoice(invoice)
      writeInvoice(unit, books(), null, checked, chosenPayments(books(), null, checked, field['paidBy'], idOf))
      return
    }
    case 'change-invoice': {
      const before = invoiceOf(field['invoice']).record
      const number = (field['number'] as string | null)?.trim() ?? before.number
      const client = field['client'] === null ? before.client : idOf(field['client'])
      const planItems = (field['planItems'] as string | null)?.trim() ?? before.planItems ?? ''
      const after: Invoice = {
        number,
        client,
        item: (field['item'] as string | null)?.trim() ?? before.item,
        ...(planItems === '' ? {} : { planItems }),
        amount: field['amount'] === null ? before.amount : moneyFromAmount(field['amount']),
        issued: field['issued'] === null ? before.issued : dayOf(field['issued']),
        due: optionalDay(field['due'], before.due),
        deliveryPeriod: periodOf(field['periodFrom'], field['periodTo'], before.deliveryPeriod),
        id: invoiceIdOf({ client, number }),
      }
      const checked = checkedInvoice(after)
      writeInvoice(unit, books(), before, checked, chosenPayments(books(), before.id, checked, field['paid'] === 'keep' ? null : field['paidBy'], idOf))
      return
    }
    case 'delete-invoice':
      removeInvoice(unit, records.items, invoiceOf(field['invoice']).record)
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
