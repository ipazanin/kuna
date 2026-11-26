import { words } from './words'
import type { SourceHandover } from '../domain/sourceHandover'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import { rowItemsOf } from '../../workbook/domain/rowItems'
import { addDays } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel, dayRangeLabel } from '../../../../shared/calendar/dayLabel'
import { formatAccountMoney } from '../../../../shared/money/moneyFormat'
import { listInWords } from '../../../../shared/text/listInWords'
import { plural } from '../../../../shared/text/translation'
import { listedRows } from '../../../../shared/ui/sourceHandover'
import type { HandoverWords } from '../../../../shared/ui/sourceHandover'

/** The days a bank gives rows of only right after a new approval. */
const BANK_HISTORY_DAYS = 90

function spanOf(from: CivilDate, to: CivilDate | null): string {
  return to === null ? words.dialog.handover.onwards(dayLabel(from)) : dayRangeLabel({ from, to })
}

/** The handover's warning in words, or null when it deletes nothing. */
export function handoverWords(handover: SourceHandover, book: Pick<SpendingBook, 'accounts' | 'categories' | 'items'>, today: CivilDate): HandoverWords | null {
  const { rows, receipts, held, loneLegs, linked, runs, account } = handover
  if (rows.length + held.length === 0) return null
  const days = runs.map((run) => words.dialog.handover.days(spanOf(run.from ?? account.openedOn, run.to), words.rowsFrom[run.before], words.rowsFrom[run.after]))
  const listed = rows.map((row) => `${dayLabel(row.date)}, ${row.payee === '' ? row.description : row.payee}, ${formatAccountMoney(row.amount, account.currency)}`)
  const names = (ids: readonly string[], of: readonly { readonly id: string; readonly name: string }[]): string =>
    listInWords([...new Set(ids)].map((id) => of.find((record) => record.id === id)?.name ?? ''))
  const itemsOf = rowItemsOf(book)
  const accounts = names(
    loneLegs.map((leg) => leg.account),
    book.accounts,
  )
  const categories = names(
    loneLegs.flatMap((leg) => itemsOf(leg).flatMap((item) => (item.category === null ? [] : [item.category]))),
    book.categories,
  )
  const oldDays = runs.some((run) => run.after === 'bank-link' && (run.from ?? account.openedOn) < addDays(today, -BANK_HISTORY_DAYS))
  return {
    title: rows.length === 0 ? plural(words.dialog.handover.heldTitle(held.length), held.length) : plural(words.dialog.handover.title(rows.length), rows.length),
    days,
    rows: listedRows(listed, words.dialog.handover.more),
    notes: [
      ...(receipts.length === 0 ? [] : [plural(words.dialog.handover.receipts(receipts.length), receipts.length)]),
      ...(linked === 0 ? [] : [plural(words.dialog.handover.linked(linked), linked)]),
      ...(loneLegs.length === 0 ? [] : [plural(words.dialog.cutover.loneLegs(loneLegs.length, accounts, categories), loneLegs.length)]),
      ...(held.length === 0 || rows.length === 0 ? [] : [plural(words.dialog.handover.held(held.length), held.length)]),
      words.dialog.handover.brings,
      ...(oldDays ? [words.dialog.handover.oldBankDays] : []),
    ],
  }
}
