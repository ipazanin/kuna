import type { CashMovement } from '../../workbook/domain/cashMovement'
import type { Instrument } from '../../workbook/domain/instrument'
import type { Trade } from '../../workbook/domain/trade'
import { tradeTotal } from '../../holdings/domain/lots'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** The deposit that paid for a buy of something a person already holds, in its currency at its rate, so the account's cash stays where it was and the value is what the holding is worth. */
export function matchingDeposit(buy: Trade, instrument: Instrument, id: RecordId, note: string): CashMovement {
  return { id, account: buy.account, kind: 'deposit', date: buy.date, currency: instrument.currency, amount: tradeTotal(buy, instrument.quoted), rate: buy.rate, importKey: null, note }
}
