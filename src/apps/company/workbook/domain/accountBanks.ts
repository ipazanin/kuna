import { sameBank } from '../../../../shared/recipes/domain/savedRecipe'
import { capitalised } from '../../../../shared/text/capitalised'
import type { Account } from './workbook'

/** What an import profile's name says of its bank: its words with the first letter capital, so `erste-business` reads as "Erste business". */
export function bankOfProfileName(name: string): string {
  return capitalised(name.replaceAll('-', ' '))
}

/**
 * Each account with its bank, and an account that names none with the bank of the first import profile, by the profile's name,
 * that is for it. So an account a profile read into keeps its bank before the profiles move to recipes, which writes it down.
 */
export function accountsWithBanks<Read extends Pick<Account, 'slug' | 'bank'>>(accounts: readonly Read[], profiles: readonly { readonly name: string; readonly account: string }[]): Read[] {
  const byName = [...profiles].sort((one, other) => one.name.localeCompare(other.name))
  return accounts.map((account) => {
    const profile = account.bank === '' ? byName.find((candidate) => candidate.account === account.slug) : undefined
    return profile === undefined ? account : { ...account, bank: bankOfProfileName(profile.name) }
  })
}

/** The banks the accounts name, each once in the order of the accounts, for a bank field to suggest. Two spellings of one bank, by `sameBank`, count once as the first. */
export function accountBankNames(accounts: readonly Pick<Account, 'bank'>[]): string[] {
  const names: string[] = []
  for (const { bank } of accounts) {
    if (bank !== '' && !names.some((name) => sameBank(name, bank))) names.push(bank)
  }
  return names
}

/** Whether a recipe for a bank and currency reads into the account: the account names that bank, by `sameBank`, in that currency, where its blank currency means the books' own. */
export function recipeReadsInto(account: Pick<Account, 'bank' | 'currency'>, bank: string, currency: string, booksCurrency: string): boolean {
  return sameBank(account.bank, bank) && (account.currency || booksCurrency) === currency
}

/** A bank and currency several accounts share, so a recipe for that bank cannot tell which of them a file is for. */
export interface SharedBank {
  readonly bank: string
  readonly currency: string
  readonly accounts: number
}

/** For each account, the bank and currency it shares with another, or null for an account a recipe of its bank finds alone or one that names no bank. */
export function sharedBanks(accounts: readonly Pick<Account, 'bank' | 'currency'>[], booksCurrency: string): (SharedBank | null)[] {
  return accounts.map((account) => {
    if (account.bank === '') return null
    const currency = account.currency || booksCurrency
    const sharing = accounts.filter((other) => recipeReadsInto(other, account.bank, currency, booksCurrency)).length
    return sharing > 1 ? { bank: account.bank, currency, accounts: sharing } : null
  })
}
