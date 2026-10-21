import { serialFromCivilDate } from '../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../shared/calendar/civilDate'
import { amountOf } from '../../../shared/money/money'
import type { Money } from '../../../shared/money/money'
import { cellText } from '../../../shared/text/cellText'
import { editsOf, untouchedOf } from '../../workbook/application/tabRowWrites'
import type { TabRowRules } from '../../workbook/application/tabRowWrites'
import type { RowCells } from '../../workbook/domain/rowChanges'
import { definedClientSlugs, readInvoiceRows } from '../../workbook/infrastructure/workbookReader'
import { TEMPLATE_COLUMNS } from '../../workbook/infrastructure/workbookTemplate'
import { invoiceChangeRefusals } from '../domain/invoiceGuards'

/** The eight columns the invoice generator writes. It refuses a tab whose header lacks one or names another, so the app needs all eight too. */
const INVOICE_COLUMNS = TEMPLATE_COLUMNS.invoices.map((column) => column.name)

/** An invoice as the dialog gives it. A blank due date or delivery period is null. */
export interface InvoiceDraft {
  readonly number: string
  readonly client: string
  readonly item: string
  readonly amount: Money
  readonly issued: CivilDate
  readonly due: CivilDate | null
  readonly periodFrom: CivilDate | null
  readonly periodTo: CivilDate | null
}

/** The row as the generator writes it: the number as text, the amount as a number and each date as a serial number, so the cell is a date cell. */
export function invoiceCellsOf(draft: InvoiceDraft): RowCells {
  const serial = (date: CivilDate | null): number | string => (date === null ? '' : serialFromCivilDate(date))
  return {
    number: draft.number.trim(),
    client: draft.client.trim().toLowerCase(),
    item: draft.item.trim(),
    amount: amountOf(draft.amount),
    issued: serialFromCivilDate(draft.issued),
    due: serial(draft.due),
    period_from: serial(draft.periodFrom),
    period_to: serial(draft.periodTo),
  }
}

export const INVOICE_ROWS: TabRowRules = {
  tab: 'invoices',
  noun: { one: 'invoice', many: 'invoices', article: 'an' },
  columns: INVOICE_COLUMNS,
  required: INVOICE_COLUMNS,
  caseless: ['client'],
  reads: ['clients'],
  read: (rows, fresh) => readInvoiceRows(rows, definedClientSlugs(fresh.clients?.rows ?? [])),
  refusals: (check) =>
    invoiceChangeRefusals(
      editsOf(check, (cells) => ({ number: cellText(cells.number), amount: cells.amount ?? '' })),
      untouchedOf(check, (cells) => ({ number: cellText(cells.number) })),
    ),
  label: (cells) => cellText(cells.number) || 'without a number',
}
