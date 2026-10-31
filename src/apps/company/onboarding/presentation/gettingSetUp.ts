import type { RouteLocationRaw } from 'vue-router'

import { REQUIRED_ISSUER } from '../../invoicing/domain/invoiceDocument'
import type { Workbook } from '../../workbook/domain/workbook'
import { categoriesAsNewBooksStart } from '../../workbook/presentation/workbookFiles'
import { words } from './words'

/** One thing new books still lack, said in a line, with the screen that does it. */
export interface SetUpLine {
  readonly key: string
  readonly text: string
  readonly link: { readonly label: string; readonly to: RouteLocationRaw }
}

/**
 * What the books still lack after onboarding, each gone once done: a first statement, the
 * statements folder while filing on sync is on without one, a look over the categories while they
 * are the ones new books start with, and the company's invoice details once there is a client to
 * invoice.
 */
export function gettingSetUp(workbook: Workbook): SetUpLine[] {
  const lines: SetUpLine[] = []
  if (workbook.transactions.length === 0) {
    lines.push({ key: 'first-statement', text: words.setUp.firstStatement, link: { label: words.setUp.importLink, to: { path: '/company/transactions', query: { tab: 'import' } } } })
  }
  if (workbook.settings.statementsSync && workbook.settings.statementsFolder.length === 0) {
    lines.push({ key: 'statements-folder', text: words.setUp.statementsFolder, link: { label: words.setUp.settingsLink, to: '/company/settings' } })
  }
  if (categoriesAsNewBooksStart(workbook.categories)) {
    lines.push({
      key: 'categories',
      text: words.setUp.categories,
      link: { label: words.setUp.categoriesLink, to: { path: '/company/settings', query: { tab: 'categories' } } },
    })
  }
  if (workbook.clients.length > 0 && REQUIRED_ISSUER.some(([field]) => workbook.settings.invoicing[field].trim() === '')) {
    lines.push({ key: 'invoice-terms', text: words.setUp.invoiceTerms, link: { label: words.setUp.clientsLink, to: { path: '/company/invoicing', query: { tab: 'clients' } } } })
  }
  return lines
}
