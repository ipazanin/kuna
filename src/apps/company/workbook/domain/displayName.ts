import type { Workbook } from './workbook'

/** Words a slug carries in lower case that read as acronyms on screen. */
const ACRONYMS = new Set(['ai', 'vat', 'it'])

/**
 * What a category, account or family is called on screen: its label when the workbook gives one,
 * else its slug with spaces for hyphens and a capital first letter, such as "AI services".
 */
export function displayName(slug: string, label = ''): string {
  if (label.trim() !== '') {
    return label.trim()
  }
  const text = slug
    .split('-')
    .filter((word) => word !== '')
    .map((word) => (ACRONYMS.has(word) ? word.toUpperCase() : word))
    .join(' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export interface DisplayNames {
  category(slug: string): string
  account(slug: string): string
}

/** The screen names of a workbook's categories and accounts. A slug the tabs do not define still reads well. */
export function displayNamesOf(workbook: Pick<Workbook, 'categories' | 'accounts'>): DisplayNames {
  const categories = new Map(workbook.categories.map((category) => [category.slug, category.label ?? '']))
  const accounts = new Map(workbook.accounts.map((account) => [account.slug, account.label ?? '']))
  return {
    category: (slug) => displayName(slug, categories.get(slug)),
    account: (slug) => displayName(slug, accounts.get(slug)),
  }
}
