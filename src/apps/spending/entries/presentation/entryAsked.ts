import type { Account } from '../../workbook/domain/account'
import { SPENDING_APP } from '../../workbook/domain/spendingBooks'
import { TRANSACTION_RECORDS } from '../../workbook/domain/spendingKinds'
import type { Transaction } from '../../workbook/domain/transaction'
import type { AskedElement } from '../../../../shared/ai/presentation/chatDock'
import { dayLabel } from '../../../../shared/calendar/dayLabel'

/** An entry the chat is about, named by its day and account. Its payee and amount reach the chat only through a read, as Anonymise and the read switch allow. */
export function entryAsked(entry: Pick<Transaction, 'id' | 'date'>, account: Pick<Account, 'name'> | undefined): AskedElement {
  return {
    key: `spending-entry-${entry.id}`,
    label: account === undefined ? dayLabel(entry.date) : `${dayLabel(entry.date)}, ${account.name}`,
    about: { kind: 'record', app: SPENDING_APP, recordKind: TRANSACTION_RECORDS.name, id: entry.id },
  }
}
