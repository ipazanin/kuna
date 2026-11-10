import type { Account } from '../../workbook/domain/account'
import { EURO } from '../../../../shared/money/currencyCode'
import type { RatesState } from '../../../../shared/rates/domain/ratesState'

/** Whether a figure over these accounts waits for the rates: they are loading and one of the accounts is in another currency. */
export function waitsForRates(accounts: readonly Account[], rates: RatesState): boolean {
  return rates === 'loading' && accounts.some((account) => account.currency !== EURO)
}
