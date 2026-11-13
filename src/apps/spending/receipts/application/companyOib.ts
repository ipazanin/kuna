import type { RouteLocationRaw } from 'vue-router'

import { COMPANY_OIB_LINK, publishedCompany } from '../../../company/facts'

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
