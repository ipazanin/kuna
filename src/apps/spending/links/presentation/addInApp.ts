import type { CompanyCostCategory } from '../../company/application/companyFacts'
import type { ShownTarget } from '../application/linkTargets'
import type { InformalLoanTarget } from '../domain/linkTarget'
import { words } from './words'

/** What the entry dialog adds in another app from a saved entry before linking the entry to it: a movement to an informal loan in Loans, or a cost you paid to Company. */
export type AddInApp = { readonly app: 'loans'; readonly loans: readonly (ShownTarget & InformalLoanTarget)[] } | { readonly app: 'company'; readonly costCategories: readonly CompanyCostCategory[] }

/** The dialog's title, its help and its save button while it adds the record. */
export function addInAppWords(adding: AddInApp): { readonly open: string; readonly help: string; readonly save: string } {
  return adding.app === 'loans' ? words.add : words.company.add
}
