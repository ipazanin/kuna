import { words } from './words'
import type { StartDayMove } from '../domain/startDayMove'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import { rowItemsOf } from '../../workbook/domain/rowItems'
import { formatAccountMoney } from '../../../../shared/money/moneyFormat'
import { listInWords } from '../../../../shared/text/listInWords'
import { plural } from '../../../../shared/text/translation'

/** What moving the start day later deletes, in the words the account dialog and the chat's card both show. */
export interface CutoverWords {
  readonly title: string
  /** One line for each kind of record that goes. */
  readonly goes: readonly string[]
  /** Where the transfers' other legs stay, or null when no transfer is among the rows that go. */
  readonly loneLegs: string | null
  readonly opening: string
}

/** The move's confirm in words, with the opening Kuna worked out. */
export function cutoverWords(move: StartDayMove, book: Pick<SpendingBook, 'accounts' | 'categories' | 'items'>): CutoverWords {
  const { rows, receipts, parts, held } = words.dialog.cutover
  const goes = [
    { count: move.rows.length, forms: rows },
    { count: move.receipts.length, forms: receipts },
    { count: move.parts.length, forms: parts },
    { count: move.held.length, forms: held },
  ]
    .filter(({ count }) => count > 0)
    .map(({ count, forms }) => plural(forms(count), count))
  const names = (ids: readonly string[], of: readonly { readonly id: string; readonly name: string }[]): string =>
    listInWords([...new Set(ids)].map((id) => of.find((record) => record.id === id)?.name ?? ''))
  const legs = move.loneLegs
  const accounts = names(
    legs.map((leg) => leg.account),
    book.accounts,
  )
  const itemsOf = rowItemsOf(book)
  const categories = names(
    legs.flatMap((leg) => itemsOf(leg).flatMap((item) => (item.category === null ? [] : [item.category]))),
    book.categories,
  )
  return {
    title: words.dialog.cutover.title(move.startsOn),
    goes,
    loneLegs: legs.length === 0 ? null : plural(words.dialog.cutover.loneLegs(legs.length, accounts, categories), legs.length),
    opening: words.dialog.cutover.opening(formatAccountMoney(move.opening, move.account.currency)),
  }
}
