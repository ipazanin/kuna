import type { RouteLocationRaw } from 'vue-router'

import { addOwnerAdvance, advanceCategories, COMPANY_OIB_LINK, publishedCompany } from '../../../company/facts'
import type { PublishedAdvanceCategory } from '../../../company/facts'
import type { AddedInApp } from '../../links/application/linkWithRecord'
import type { OwnerAdvanceTarget } from '../../links/domain/linkTarget'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { Money } from '../../../../shared/money/money'

/** Company's OIB as Spending reads it, blank while Company holds none, a wait while Company opens, a failure, or null while Company is not set up on this device. */
export type CompanyOib = { readonly oib: string } | 'opening' | 'failed' | null

/** Where Company's OIB is set, which opens Company's first run while it is not set up. */
export const COMPANY_OIB_PAGE: RouteLocationRaw = COMPANY_OIB_LINK

/** Company's OIB on this device, which tells a receipt bought for the company. */
export function companyOib(): CompanyOib {
  const published = publishedCompany()
  return published === null || typeof published === 'string' ? published : { oib: published.oib }
}

/** The OIB a receipt's buyer must name to be the company's, blank unless Company is open with one, so no receipt is the company's. */
export function oibToMatch(company: CompanyOib): string {
  return company === null || typeof company === 'string' ? '' : company.oib
}

/** A category of Company's that a cost you paid for your company may count in, by its slug and the name Company gives it. */
export type CompanyCostCategory = PublishedAdvanceCategory

/** The categories of Company's books on this device that a cost you paid for it may count in, none while Company is not open or keeps no owner pay. */
export function companyCostCategories(): readonly CompanyCostCategory[] {
  return advanceCategories()
}

/** A cost you paid for your company that a row adds to Company. */
export interface NewCompanyCost {
  readonly day: CivilDate
  /** Above zero. */
  readonly amount: Money
  readonly description: string
  readonly category: CompanyCostCategory
}

/** Adds the cost to Company as an owner advance, under the title Spending gives the write. Throws with the reason when Company refuses it. */
export async function addCompanyCost(cost: NewCompanyCost, title: string): Promise<AddedInApp<OwnerAdvanceTarget>> {
  const added = await addOwnerAdvance({ day: cost.day, amount: cost.amount, description: cost.description, category: cost.category.slug }, title)
  return {
    target: { kind: 'owner-advance', link: added.link, day: cost.day, amount: cost.amount, description: cost.description, categoryName: cost.category.name, to: added.to },
    undo: () => added.undo(),
  }
}
