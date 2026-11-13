import type { RouteLocationRaw } from 'vue-router'

import { homeCardFigures } from '../../shared/app/homeCardFigures'
import { TERMS_LINK } from './invoicing/presentation/invoicingLinks'
import { useWorkbook } from './workbook/application/workbookStore'
import type { Workbook } from './workbook/domain/workbook'

/** The company as another app reads it. */
export interface PublishedCompany {
  /** Eleven digits, or blank while Company's invoicing terms hold none. */
  readonly oib: string
}

/** The invoicing terms, where Company's OIB is set. While Company is not set up, the link opens its first run. */
export const COMPANY_OIB_LINK: RouteLocationRaw = TERMS_LINK

/** The company of the books, for a reader that has them in hand, such as check:figures. */
export function companyOf(workbook: Pick<Workbook, 'settings'>): PublishedCompany {
  return { oib: workbook.settings.invoicing.oib }
}

const { state } = useWorkbook()

/** The company of the books on screen, a wait while they open, a failure, or null while Company is not set up. */
export function publishedCompany(): PublishedCompany | 'opening' | 'failed' | null {
  return homeCardFigures(state, companyOf)
}
