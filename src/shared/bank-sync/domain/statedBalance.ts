import type { BankBalance } from './bankAnswer'
import { accountMoneyFromAmount, subtractAccountMoney, sumAccountMoney, ZERO_ACCOUNT_MONEY } from '../../money/accountMoney'
import type { AccountMoney } from '../../money/accountMoney'
import { decimalOf } from '../../storage/domain/storedFields'

/** The booked balances, newest kind first, which count booked rows only. */
const BOOKED_TYPES: readonly string[] = ['ITBD', 'CLBD']

/** The available balances, newest kind first, which count what the bank holds as not booked yet too. */
const AVAILABLE_TYPES: readonly string[] = ['ITAV', 'CLAV']

/** A bank's balance and whether it counts booked rows only or every row, those not booked yet among them. */
export interface BankStated {
  readonly balance: AccountMoney
  readonly kind: 'booked' | 'available'
}

function balanceOfType(balances: readonly BankBalance[], types: readonly string[]): AccountMoney | null {
  const found = types.map((type) => balances.find((balance) => balance.type === type)).find((balance) => balance !== undefined)
  const amount = found === undefined ? null : decimalOf(found.amount)
  return amount === null ? null : accountMoneyFromAmount(amount)
}

/** The bank's balance in the currency, a booked one if it gives one, else the first it lists, read as available. Null when it gives none that can be read. */
export function statedBalance(balances: readonly BankBalance[], currency: string): BankStated | null {
  const inCurrency = balances.filter((balance) => balance.currency === currency)
  const booked = balanceOfType(inCurrency, BOOKED_TYPES)
  if (booked !== null) return { balance: booked, kind: 'booked' }
  const first = inCurrency[0] === undefined ? null : decimalOf(inCurrency[0].amount)
  return first === null ? null : { balance: accountMoneyFromAmount(first), kind: 'available' }
}

/**
 * What the bank holds as not booked yet and does not list as a row: its available balance less its booked one less the
 * rows not booked yet it listed. Null when that is zero or the bank gives either balance not.
 */
export function unlistedPending(balances: readonly BankBalance[], currency: string, listed: readonly AccountMoney[]): AccountMoney | null {
  const inCurrency = balances.filter((balance) => balance.currency === currency)
  const booked = balanceOfType(inCurrency, BOOKED_TYPES)
  const available = balanceOfType(inCurrency, AVAILABLE_TYPES)
  if (booked === null || available === null) return null
  const unlisted = subtractAccountMoney(subtractAccountMoney(available, booked), sumAccountMoney(listed))
  return unlisted === ZERO_ACCOUNT_MONEY ? null : unlisted
}
