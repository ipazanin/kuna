import type { SetUpLine } from '../../../../shared/app/appContribution'
import { listInWords } from '../../../../shared/text/listInWords'
import { plural } from '../../../../shared/text/translation'
import { REQUIRED_ISSUER } from '../../invoicing/domain/invoiceDocument'
import { payeesWaiting } from '../../rules/domain/ruleCoverage'
import { REVIEW_LINK } from '../../transactions/presentation/transactionsLinks'
import { ruleCouldFile } from '../../workbook/domain/needsReview'
import type { Workbook } from '../../workbook/domain/workbook'
import { categoriesAsNewBooksStart } from '../../workbook/presentation/workbookFiles'
import { words } from './words'

/** The line a person settles where it stands, with These look right. */
export const CATEGORIES_LINE = 'categories'

/** The answer that clears it. */
export const CATEGORIES_LOOK_RIGHT = 'categories-look-right'

/** How many payees a first statement teaches, and how many rules of a person's own end the teaching. */
const PAYEES_TO_TEACH = 5

/** The line of a books file with rows a rule could file and fewer working rules than the payees to teach. The rules a Croatian d.o.o. starts with only ask for review, so they do not count. */
function firstRulesLine(workbook: Workbook): SetUpLine | null {
  const unfiled = workbook.transactions.filter(ruleCouldFile)
  if (unfiled.length === 0 || workbook.rules.filter((rule) => rule.enabled && rule.confidence === 'rule').length >= PAYEES_TO_TEACH) return null
  const names = payeesWaiting(unfiled, new Set(workbook.settings.cardSettlementIbans))
    .map((payee) => payee.name)
    .filter((name) => name !== '')
    .slice(0, PAYEES_TO_TEACH)
  const rows = workbook.transactions.length
  const filed = plural(words.setUp.filed(workbook.transactions.filter((row) => row.flaggedBy === 'rule').length, rows), rows)
  return {
    key: 'first-rules',
    text: names.length === 0 ? filed : `${filed} ${words.setUp.teach(listInWords(names))}`,
    link: { label: words.setUp.reviewLink, to: REVIEW_LINK },
  }
}

/**
 * What the books still lack after onboarding, each gone once done: a first statement, its biggest
 * payees taught as rules, the statements folder while filing on sync is on without one, a look over
 * the categories new books start with until someone says they look right, and the company's invoice
 * details once there is a client to invoice.
 */
export function gettingSetUp(workbook: Workbook, categoriesLookRight = false): SetUpLine[] {
  const firstRules = firstRulesLine(workbook)
  const lines: SetUpLine[] = firstRules === null ? [] : [firstRules]
  if (workbook.transactions.length === 0) {
    lines.push({ key: 'first-statement', text: words.setUp.firstStatement, link: { label: words.setUp.importLink, to: { path: '/company/transactions', query: { tab: 'import' } } } })
  }
  if (workbook.settings.statementsSync && workbook.settings.statementsFolder.length === 0) {
    lines.push({ key: 'statements-folder', text: words.setUp.statementsFolder, link: { label: words.setUp.settingsLink, to: '/company/settings' } })
  }
  if (!categoriesLookRight && categoriesAsNewBooksStart(workbook.categories)) {
    lines.push({
      key: CATEGORIES_LINE,
      text: words.setUp.categories,
      link: { label: words.setUp.categoriesLink, to: { path: '/company/settings', query: { tab: 'categories' } } },
    })
  }
  if (workbook.clients.length > 0 && REQUIRED_ISSUER.some(([field]) => workbook.settings.invoicing[field].trim() === '')) {
    lines.push({ key: 'invoice-terms', text: words.setUp.invoiceTerms, link: { label: words.setUp.clientsLink, to: { path: '/company/invoicing', query: { tab: 'clients' } } } })
  }
  return lines
}
