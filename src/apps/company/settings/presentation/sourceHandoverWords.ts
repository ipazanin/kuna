import { words } from './words'
import type { SourceHandover } from '../domain/sourceHandover'
import type { CompanySource, Transaction } from '../../workbook/domain/workbook'
import { givenDaysLine, handedDaysLine } from '../../../../shared/app/sourceDaysWords'
import type { SourceNames } from '../../../../shared/app/sourceDaysWords'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import { plural } from '../../../../shared/text/translation'
import { listedRows } from '../../../../shared/ui/sourceHandover'
import type { HandoverWords } from '../../../../shared/ui/sourceHandover'

const SOURCE_WORDS: SourceNames<CompanySource> = {
  mail: words.accounts.rowsFrom.mail,
  'provider-file': words.accounts.rowsFrom.providerFile,
  'by-hand': words.accounts.rowsFrom.byHand,
}

/** The handover's warning in words, or null when it takes nothing out. `paysInvoice` says whether a row's items pay an invoice, which its line then says. */
export function handoverWords(handover: SourceHandover, paysInvoice: (row: Transaction) => boolean): HandoverWords | null {
  const { rows, runs, given } = handover
  if (rows.length === 0) return null
  const text = words.accounts.handover
  const lineOf = (row: Transaction): string => {
    const line = `${dayLabel(row.date)}, ${row.counterparty === '' ? row.description : row.counterparty}, ${formatMoney(row.amount)}`
    return paysInvoice(row) ? text.paying(line) : line
  }
  const paying = rows.filter(paysInvoice).length
  return {
    title: plural(text.title(rows.length), rows.length),
    days: [...given.map((run) => givenDaysLine(run, SOURCE_WORDS)), ...runs.map((run) => handedDaysLine(run, SOURCE_WORDS))],
    rows: listedRows(rows.map(lineOf), text.more),
    notes: [...(paying === 0 ? [] : [plural(text.paysInvoice(paying), paying)]), text.brings],
  }
}
