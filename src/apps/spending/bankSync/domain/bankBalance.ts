import type { BankBalance } from './bankAnswer'
import { accountBalance } from '../../accounts/domain/accountBalance'
import type { Account } from '../../workbook/domain/account'
import type { Transaction } from '../../workbook/domain/transaction'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { accountMoneyFromAmount, addAccountMoney, subtractAccountMoney, sumAccountMoney, ZERO_ACCOUNT_MONEY } from '../../../../shared/money/accountMoney'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import { decimalOf } from '../../../../shared/storage/domain/storedFields'

/** The booked balances, newest kind first, which count booked rows only. */
const BOOKED_TYPES: readonly string[] = ['ITBD', 'CLBD']

/** The available balances, newest kind first, which count what the bank holds as not booked yet too. */
const AVAILABLE_TYPES: readonly string[] = ['ITAV', 'CLAV']

/** A bank's balance and whether it counts booked rows only or every row, those not booked yet among them. */
export interface BankStated {
  readonly balance: AccountMoney
  readonly kind: 'booked' | 'available'
}

/** What a bank says one Spending account holds, and what it holds as not booked yet without listing it as a row, null when nothing. */
export interface StatedBalance extends BankStated {
  readonly account: Account
  readonly unlisted: AccountMoney | null
}

/** An account whose balance on the day differs from what its bank says. */
export interface BalanceDifference {
  readonly account: Account
  readonly stated: AccountMoney
  readonly worked: AccountMoney
  /** The opening that would make the two agree. */
  readonly fixedOpening: AccountMoney
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

/** The rows a balance of the kind counts: a booked one leaves out rows the bank has not booked yet. */
export function rowsCountedBy<Row extends Pick<Transaction, 'pending'>>(kind: BankStated['kind'], rows: readonly Row[]): readonly Row[] {
  return kind === 'booked' ? rows.filter((row) => !row.pending) : rows
}

/** Each account whose balance on the day differs from what the bank says, a booked balance read against the booked rows. It never refuses, as with a file's balance, since the rows are what count. */
export function balanceDifferences(stated: readonly StatedBalance[], rows: readonly Transaction[], day: CivilDate): readonly BalanceDifference[] {
  return stated.flatMap(({ account, balance, kind }) => {
    const worked = accountBalance(account, rowsCountedBy(kind, rows), day)
    if (worked === balance) return []
    return [{ account, stated: balance, worked, fixedOpening: addAccountMoney(account.opening, subtractAccountMoney(balance, worked)) }]
  })
}

/** The differences whose account still opens as it did at the fetch, so one fixed or edited since drops out. */
export function currentDifferences(differences: readonly BalanceDifference[], accounts: readonly Pick<Account, 'id' | 'opening'>[]): readonly BalanceDifference[] {
  return differences.filter((difference) => accounts.find((account) => account.id === difference.account.id)?.opening === difference.account.opening)
}
