import { currencyCodeOf } from '../../../../shared/money/currencyCode'
import type { SavedRecipe } from '../../../../shared/recipes/domain/savedRecipe'
import type { RecipeField } from '../../../../shared/recipes/domain/recipe'
import type { TableRecipeDraft } from '../../../../shared/recipes/domain/tableRecipeDraft'
import { recordIdOf } from '../../../../shared/storage/domain/recordId'
import { bankOfProfileName } from '../../workbook/domain/accountBanks'
import { RECIPE_RECORDS } from '../../workbook/domain/coreKinds'
import type { Account } from '../../workbook/domain/workbook'
import type { DateFormat, ImportProfile } from './importProfile'
import { companyTableRecipeOf } from './tableRecipes'

/**
 * The day formats a profile's date format reads as a recipe: its own, with a closing dot where the format allows one, and a sheet's
 * own day cells, which a profile read as days whatever its format said.
 */
const PROFILE_DAY_FORMATS: Readonly<Record<DateFormat, readonly string[]>> = {
  'dd.mm.yyyy': ['dd.MM.yyyy', 'dd.MM.yyyy.'],
  'dd/mm/yyyy': ['dd/MM/yyyy'],
  'mm/dd/yyyy': ['MM/dd/yyyy'],
  'yyyy-mm-dd': ['yyyy-MM-dd'],
}

const SHEET_DAY_FORMATS = ['yyyy-MM-dd', 'yyyy-MM-dd HH:mm:ss']

/** The draft a profile reads as, with its columns, its first day format and its decimal mark, and every row an entry. */
function draftOfProfile(profile: ImportProfile): TableRecipeDraft {
  const columns = { balance: profile.balance, counterparty: profile.counterparty, counterpartyIban: profile.counterpartyIban, description: profile.description, reference: profile.reference }
  return {
    name: profile.name,
    date: { column: profile.date, format: PROFILE_DAY_FORMATS[profile.dateFormat][0]! },
    amount: 'signed' in profile.amount ? { column: profile.amount.signed } : { debit: profile.amount.debit, credit: profile.amount.credit },
    mark: profile.decimal,
    columns: Object.fromEntries(Object.entries(columns).filter(([, column]) => column !== '')),
    kinds: [{ kind: 'entry', test: null }],
  }
}

/**
 * The recipe an import profile reads as, under an id its name makes, so reading it before the move and keeping it after are the
 * same recipe: the account it names gives the bank and the currency, a blank currency meaning the books' own. A profile whose
 * account the books lack takes its own name as the bank and the books' currency, so Import names that bank when it refuses it.
 */
export function recipeOfProfile(profile: ImportProfile, accounts: readonly Pick<Account, 'slug' | 'bank' | 'currency'>[], booksCurrency: string): SavedRecipe | null {
  const account = accounts.find((candidate) => candidate.slug === profile.account)
  const bank = account === undefined || account.bank === '' ? bankOfProfileName(profile.name) : account.bank
  const currency = currencyCodeOf(account?.currency || booksCurrency)
  const made = companyTableRecipeOf(recordIdOf(RECIPE_RECORDS, profile.name), draftOfProfile(profile), bank, currency)
  if (!('saved' in made)) return null
  const formats = [...new Set([...PROFILE_DAY_FORMATS[profile.dateFormat], ...SHEET_DAY_FORMATS])]
  const sections = made.saved.recipe.sections.map((section) => ({
    ...section,
    kinds: section.kinds.map((kind) => ({
      ...kind,
      fields: Object.fromEntries(Object.entries(kind.fields).map(([name, field]): [string, RecipeField] => [name, field.as === 'date' ? { ...field, formats } : field])),
    })),
  }))
  return { ...made.saved, recipe: { ...made.saved.recipe, sections } }
}

/** What moving the profiles writes: a recipe for each, and the bank each account takes that only a profile gave it. */
export interface ProfileMove {
  readonly recipes: readonly SavedRecipe[]
  readonly banks: readonly { readonly account: string; readonly bank: string }[]
}

/**
 * The move of the books' import profiles to recipes. `accounts` are as the books read them, where an account that names no bank
 * of its own takes one from a profile, and `stored` are the banks the accounts tab itself holds, by account. A profile the
 * recipe draft cannot hold, such as one whose columns read twice, is left out.
 */
export function profileMove(
  profiles: readonly ImportProfile[],
  accounts: readonly Pick<Account, 'slug' | 'bank' | 'currency'>[],
  stored: ReadonlyMap<string, string>,
  booksCurrency: string,
): ProfileMove {
  return {
    recipes: profiles.flatMap((profile) => recipeOfProfile(profile, accounts, booksCurrency) ?? []),
    banks: accounts.filter((account) => account.bank !== '' && (stored.get(account.slug) ?? '') === '').map((account) => ({ account: account.slug, bank: account.bank })),
  }
}
