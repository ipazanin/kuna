import { words } from './words'
import { NEW_ACCOUNT_DEFAULTS, rowsFromOfDetails } from '../../workbook/domain/account'
import type { Account, AccountKind } from '../../workbook/domain/account'
import type { LinkableBank } from '../../workbook/domain/spendingSettings'

/**
 * A new account as its bank or its file describes it, named from the bank, the currency and whether it saves. A name another
 * account already has gains the IBAN's last four characters. The holder's name never comes into it.
 */
export function draftedAccount(
  details: Pick<Account, 'kind' | 'currency' | 'iban' | 'opening' | 'openedOn'> & { readonly bank: LinkableBank },
  accounts: readonly Pick<Account, 'name'>[],
): Omit<Account, 'id'> {
  const plain = words.draftName(details.bank, details.currency, details.kind === 'savings')
  const name = details.iban !== '' && accounts.some((account) => account.name.trim() === plain) ? `${plain} ${details.iban.slice(-4)}` : plain
  return { ...details, name, rowsFrom: rowsFromOfDetails(details), ...NEW_ACCOUNT_DEFAULTS }
}

/**
 * The IBAN a new Revolut account of the kind shares with the file's other Revolut accounts of that kind, since Revolut gives one
 * IBAN for every currency of an account. Blank while they hold none, or more than one, since then which it shares cannot be told.
 */
export function revolutIban(kind: AccountKind, accounts: readonly Pick<Account, 'bank' | 'kind' | 'iban'>[]): string {
  const ibans = new Set(accounts.filter((account) => account.bank === 'revolut' && account.kind === kind && account.iban !== '').map((account) => account.iban))
  return ibans.size === 1 ? [...ibans][0]! : ''
}
