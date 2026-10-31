import type { Workbook } from './workbook'
import { slugInWords } from './slugInWords'
import { words } from './words'

/**
 * What a category or family is called on screen: its label when the workbook gives one, else its
 * name in the language on screen. A name the file gives always wins, so only what nobody typed
 * follows the language.
 */
export function displayName(slug: string, label = ''): string {
  return label.trim() || words.unlabelled(slug)
}

export interface DisplayNames {
  category(slug: string): string
  account(slug: string): string
}

/** The screen names of a workbook's categories and accounts. A slug the tabs do not define still reads well. New books start with no account, so an account has no name of Kuna's. */
export function displayNamesOf(workbook: Pick<Workbook, 'categories' | 'accounts'>): DisplayNames {
  const categories = new Map(workbook.categories.map((category) => [category.slug, category.label ?? '']))
  const accounts = new Map(workbook.accounts.map((account) => [account.slug, account.label ?? '']))
  return {
    category: (slug) => displayName(slug, categories.get(slug)),
    account: (slug) => accounts.get(slug)?.trim() || slugInWords(slug),
  }
}
