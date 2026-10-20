import type { CivilDate } from '../../../shared/calendar/civilDate'
import { monthOf } from '../../../shared/calendar/monthKey'
import { sumMoney } from '../../../shared/money/money'
import type { Money } from '../../../shared/money/money'
import type { ExpectedInvoice } from '../../billingPlan/domain/expectedInvoices'

/** One line of an invoice: a service at quantity one, priced without VAT. */
export interface InvoiceLine {
  readonly description: string
  readonly amount: Money
}

/**
 * The client's plan rows still open up to the end of the issue month, oldest first, one line each
 * for what is still to invoice of it. A row's description names the line, or its item when blank.
 */
export function plannedLines(expected: readonly ExpectedInvoice[], client: string, issued: CivilDate): InvoiceLine[] {
  const issueMonth = monthOf(issued)
  return expected
    .filter((invoice) => invoice.client === client && invoice.month <= issueMonth)
    .flatMap((invoice) => invoice.items)
    .map((item) => ({ description: item.row.description || item.row.item, amount: item.open }))
}

export function linesTotal(lines: readonly InvoiceLine[]): Money {
  return sumMoney(lines.map((line) => line.amount))
}

/** The register keeps one row per invoice, so its item names every line. */
export function registerItemOf(lines: readonly InvoiceLine[]): string {
  return lines.map((line) => line.description.trim()).join('; ')
}

/** Why the lines cannot go on an invoice, each a sentence. Empty when they can. */
export function lineProblems(lines: readonly InvoiceLine[]): string[] {
  if (lines.length === 0) return ['Add a line.']
  const problems: string[] = []
  if (lines.some((line) => line.description.trim() === '')) problems.push('Every line needs a description.')
  if (lines.some((line) => !(line.amount > 0))) problems.push('Every line needs an amount above zero.')
  return problems
}
