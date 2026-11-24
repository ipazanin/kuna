import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { monthOf } from '../../../../shared/calendar/monthKey'
import { sumMoney } from '../../../../shared/money/money'
import type { ExpectedInvoice } from '../../billingPlan/domain/expectedInvoices'
import type { MatchedBillingItem } from '../../billingPlan/domain/plannedAgainstInvoiced'
import type { Client, Invoice } from '../../workbook/domain/workbook'
import type { InvoiceTemplateLine } from './invoiceTemplate'
import { linesTotal } from './invoiceLine'
import type { InvoiceLine } from './invoiceLine'
import { monthInLanguage } from './invoiceMail'

/** The client's plan rows still open up to the end of the issue month, oldest first. */
export function openRowsFor(expected: readonly ExpectedInvoice[], client: string, issued: CivilDate): MatchedBillingItem[] {
  const issueMonth = monthOf(issued)
  return expected.filter((invoice) => invoice.client === client && invoice.month <= issueMonth).flatMap((invoice) => invoice.items)
}

/** One line for each open row, for what is still to invoice of it. A row's description names the line, or its item when blank. */
export function plannedLines(open: readonly MatchedBillingItem[]): InvoiceLine[] {
  return open.map((row) => ({ description: row.row.description || row.row.item, amount: row.open, items: [row.row.item] }))
}

/**
 * The client's own lines, each summing the open rows whose item it names, and the last one also every
 * open row no line names, so the total is still what the plan has open. A line that sums nothing is
 * left out, and `{month}` becomes the issue month in the client's mail language.
 */
export function templatedLines(open: readonly MatchedBillingItem[], template: readonly InvoiceTemplateLine[], mailLanguage: string, issued: CivilDate): InvoiceLine[] {
  const last = template.length - 1
  const lineOf = (item: string): number => {
    const named = template.findIndex((line) => line.items.includes(item))
    return named === -1 ? last : named
  }
  const month = monthInLanguage(issued, mailLanguage)
  return template.flatMap((line, index) => {
    const summed = open.filter((row) => lineOf(row.row.item) === index)
    if (summed.length === 0) return []
    const items = [...new Set(summed.map((row) => row.row.item))]
    return [{ description: line.text.replaceAll('{month}', month), amount: sumMoney(summed.map((row) => row.open)), items }]
  })
}

/** The lines an invoice to the client starts from: its own lines when it has them, or one per open plan row. */
export function startingLines(expected: readonly ExpectedInvoice[], client: Pick<Client, 'slug' | 'invoicing'>, issued: CivilDate): InvoiceLine[] {
  const open = openRowsFor(expected, client.slug, issued)
  const template = client.invoicing.lines
  return template === undefined || template.length === 0 ? plannedLines(open) : templatedLines(open, template, client.invoicing.mailLanguage, issued)
}

/** One line for the whole amount, named as the client's last invoice was, and summing every plan item the lines did. */
export function mergedLine(lines: readonly InvoiceLine[], invoices: readonly Pick<Invoice, 'client' | 'issued' | 'item'>[], client: string): InvoiceLine {
  const previous = invoices
    .filter((invoice) => invoice.client === client)
    .reduce<Pick<Invoice, 'issued' | 'item'> | null>((latest, invoice) => (latest === null || invoice.issued > latest.issued ? invoice : latest), null)
  return {
    description: previous?.item || lines[0]?.description || '',
    amount: linesTotal(lines),
    items: [...new Set(lines.flatMap((line) => line.items))],
  }
}

/** A line's text with the plan items it sums in brackets, as the chat reads a client's invoice lines, or the text alone when it sums none. */
export function lineWithItems(text: string, items: readonly string[]): string {
  return items.length === 0 ? text : `${text} (${items.join(', ')})`
}

/** The register keeps one row per invoice, so its item names every line. */
export function registerItemOf(lines: readonly InvoiceLine[]): string {
  return lines.map((line) => line.description.trim()).join('; ')
}
