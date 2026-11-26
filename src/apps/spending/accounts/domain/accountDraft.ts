import { words } from './words'
import { NEW_ACCOUNT_DEFAULTS, sourceOfDetails } from '../../workbook/domain/account'
import { sameBank } from '../../../../shared/recipes/domain/savedRecipe'
import type { Account, AccountKind } from '../../workbook/domain/account'
import type { RowOrigin } from '../../../../shared/app/accountSource'

/**
 * A new account as its bank or its file describes it, named from the bank, the currency and whether it saves. A name another
 * account already has gains the IBAN's last four characters. The holder's name never comes into it. One drafted from the
 * bank's statement file takes its rows from that file, whose rows it is made for, and one drafted by the bank sync from the bank.
 */
export function draftedAccount(
  details: Pick<Account, 'kind' | 'currency' | 'iban' | 'opening' | 'openedOn'> & { readonly bank: string },
  accounts: readonly Pick<Account, 'name'>[],
  draftedFrom: Extract<RowOrigin, 'automation' | 'provider-file'>,
): Omit<Account, 'id'> {
  const plain = words.draftName(details.bank, details.currency, details.kind === 'savings')
  const name = details.iban !== '' && accounts.some((account) => account.name.trim() === plain) ? `${plain} ${details.iban.slice(-4)}` : plain
  const source = draftedFrom === 'provider-file' ? 'provider-file' : sourceOfDetails(details)
  return { ...details, name, sources: [{ source, from: null }], ...NEW_ACCOUNT_DEFAULTS }
}

/** Revolut's name, as its statement export and Enable Banking give it. */
export const REVOLUT_BANK = 'Revolut'

/**
 * The IBAN a new Revolut account of the kind shares with the file's other Revolut accounts of that kind, since Revolut gives one
 * IBAN for every currency of an account. Blank while they hold none, or more than one, since then which it shares cannot be told.
 */
export function revolutIban(kind: AccountKind, accounts: readonly Pick<Account, 'bank' | 'kind' | 'iban'>[]): string {
  const ibans = new Set(accounts.filter((account) => sameBank(account.bank, REVOLUT_BANK) && account.kind === kind && account.iban !== '').map((account) => account.iban))
  return ibans.size === 1 ? [...ibans][0]! : ''
}
