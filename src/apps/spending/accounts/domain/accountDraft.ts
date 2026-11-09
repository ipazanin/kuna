import { words } from './words'
import type { Account } from '../../workbook/domain/account'
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
  return { ...details, name, closed: false }
}
