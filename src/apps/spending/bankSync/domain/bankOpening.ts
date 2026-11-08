import type { Transaction } from '../../workbook/domain/transaction'
import { addDays } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { subtractAccountMoney, sumAccountMoney, ZERO_ACCOUNT_MONEY } from '../../../../shared/money/accountMoney'
import type { AccountMoney } from '../../../../shared/money/accountMoney'

/**
 * Where an opening drafted from a bank comes from: `start` when the rows reach back to an empty account, `worked` when it is
 * the bank's balance less the rows, `pending` when it is worked out the same way but the bank's balance may count rows that
 * have not booked, and `guess` when the bank gave no balance, so it is zero until you check it.
 */
export type OpeningSource = 'start' | 'worked' | 'pending' | 'guess'

export interface BankOpening {
  readonly openedOn: CivilDate
  readonly opening: AccountMoney
  readonly source: OpeningSource
  /** How many rows it was worked out from. */
  readonly rows: number
}

/**
 * What an account held at the start of the first day its bank gave a row, which is the bank's balance less every row from
 * that day on. A zero means the rows reach back to an empty account, so it opens at zero the day before. With no rows it
 * opens on the day at the balance. While the bank holds pending rows a zero proves nothing, since its balance may count them.
 */
export function openingFromBank(rows: readonly Pick<Transaction, 'date' | 'amount'>[], stated: AccountMoney | null, day: CivilDate, pending: boolean): BankOpening {
  const firstDay = rows.map((row) => row.date).reduce<CivilDate | null>((oldest, date) => (oldest === null || date < oldest ? date : oldest), null)
  if (stated === null) return { openedOn: firstDay ?? day, opening: ZERO_ACCOUNT_MONEY, source: 'guess', rows: rows.length }
  const opening = subtractAccountMoney(stated, sumAccountMoney(rows.map((row) => row.amount)))
  const source = pending ? 'pending' : 'worked'
  if (firstDay === null) return { openedOn: day, opening, source, rows: 0 }
  if (opening === ZERO_ACCOUNT_MONEY && !pending) return { openedOn: addDays(firstDay, -1), opening, source: 'start', rows: rows.length }
  return { openedOn: firstDay, opening, source, rows: rows.length }
}
