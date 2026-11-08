import { words } from './words'
import { SPENDING_REVIEW_LINK } from '../../overview/presentation/spendingLinks'
import type { Account } from '../../workbook/domain/account'
import { SPENDING_APP } from '../../workbook/domain/spendingBooks'
import { TRANSACTION_RECORDS } from '../../workbook/domain/spendingKinds'
import type { Transaction } from '../../workbook/domain/transaction'
import type { AskedElement } from '../../../../shared/ai/presentation/chatDock'
import { dayLabel } from '../../../../shared/calendar/dayLabel'

/** To review as a whole, which the chat is asked about from its card's header. */
export const REVIEW_ASKED: AskedElement = { key: 'spending-review', label: words.review.title, about: { kind: 'place', app: SPENDING_APP, route: SPENDING_REVIEW_LINK } }

/** A waiting row, named by its day and account. Its payee and amount reach the chat only through a read, as Anonymise and the read switch allow. */
export function waitingRowAsked(row: Pick<Transaction, 'id' | 'date'>, account: Pick<Account, 'name'> | undefined): AskedElement {
  return {
    key: `spending-review-row-${row.id}`,
    label: account === undefined ? dayLabel(row.date) : `${dayLabel(row.date)}, ${account.name}`,
    about: { kind: 'record', app: SPENDING_APP, recordKind: TRANSACTION_RECORDS.name, id: row.id },
  }
}
