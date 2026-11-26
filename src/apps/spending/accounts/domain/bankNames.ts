import { sameBank } from '../../../../shared/recipes/domain/savedRecipe'
import type { Account } from '../../workbook/domain/account'

/** The banks the accounts or recipes name, each once as first written, in the order they come. */
export function bankNamesOf(named: readonly Pick<Account, 'bank'>[]): readonly string[] {
  const names: string[] = []
  for (const { bank } of named) {
    if (bank !== null && bank.trim() !== '' && !names.some((name) => sameBank(name, bank))) names.push(bank.trim())
  }
  return names
}
