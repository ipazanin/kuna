import type { Transaction } from './transaction'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/**
 * A row the bank sync left out since it looks like a row Kuna has from another source. It waits on To review until the person
 * says whether it is another payment, and a later sync that brings it again finds it here by its import key.
 */
export interface HeldBankRow {
  readonly id: RecordId
  readonly account: RecordId
  readonly date: CivilDate
  readonly amount: AccountMoney
  readonly payee: string
  readonly description: string
  readonly counterpartyIban: string
  /** The bank's key the sync gave the row, which names it on its account. */
  readonly importKey: string
  /** The row on the file it looks like. */
  readonly like: RecordId
}

/** The held row's own facts as a row of the sync, for the dry run that books it. */
export function rowOfHeld(
  held: HeldBankRow,
): Pick<Transaction, 'account' | 'date' | 'amount' | 'payee' | 'category' | 'description' | 'counterpartyIban' | 'importKey' | 'movedAt' | 'pocket' | 'cashWithdrawal'> {
  return {
    account: held.account,
    date: held.date,
    amount: held.amount,
    payee: held.payee,
    category: null,
    description: held.description,
    counterpartyIban: held.counterpartyIban,
    importKey: held.importKey,
    movedAt: '',
    pocket: false,
    cashWithdrawal: false,
  }
}
