import type { RouteLocationRaw } from 'vue-router'

import { folderPathOf } from '../../../shared/text/folderPath'
import { REQUIRED_ISSUER } from '../../invoicing/domain/invoiceDocument'
import { shownPack } from '../../packs/packContribution'
import { heldSettingValue } from '../../settings/domain/settings'
import type { SettingRow } from '../../settings/domain/settings'
import type { RecordsRead } from '../../workbook/domain/recordsRead'
import type { Workbook } from '../../workbook/domain/workbook'
import { categoriesAsNewBooksStart } from '../../workbook/presentation/workbookFiles'

/** One thing new books still lack, said in a line, with the screen that does it. */
export interface SetUpLine {
  readonly key: string
  readonly text: string
  readonly link: { readonly label: string; readonly to: RouteLocationRaw }
}

/**
 * What the books still lack after onboarding, each gone once done: a first statement, the
 * statements folder while filing on sync is on without one, each folder the pack reads while its
 * module is on, a look over the categories while they are the ones new books start with, and the
 * company's invoice details once there is a client to invoice. `settings` are the settings records,
 * which hold the pack's folders.
 */
export function gettingSetUp(workbook: Workbook, settings: RecordsRead<SettingRow>): SetUpLine[] {
  const lines: SetUpLine[] = []
  if (workbook.transactions.length === 0) {
    lines.push({ key: 'first-statement', text: 'Import your first bank statement', link: { label: 'Import', to: { path: '/transactions', query: { tab: 'import' } } } })
  }
  if (workbook.settings.statementsSync && workbook.settings.statementsFolder.length === 0) {
    lines.push({ key: 'statements-folder', text: 'Name the Drive folder your bank statements are filed in, or switch filing on sync off', link: { label: 'Settings', to: '/settings' } })
  }
  const pack = shownPack(workbook.settings).onboarding
  for (const folder of pack?.folders ?? []) {
    if (folderPathOf(heldSettingValue(settings, folder.key) ?? '').length === 0) {
      lines.push({ key: folder.key, text: `Choose the folder of ${folder.holds}`, link: { label: 'Settings', to: pack!.foldersAt } })
    }
  }
  if (categoriesAsNewBooksStart(workbook.categories)) {
    lines.push({ key: 'categories', text: 'Look over the categories, which are still the ones new books start with', link: { label: 'Categories', to: { path: '/settings', query: { tab: 'categories' } } } })
  }
  if (workbook.clients.length > 0 && REQUIRED_ISSUER.some(([field]) => workbook.settings.invoicing[field].trim() === '')) {
    lines.push({ key: 'invoice-terms', text: 'Fill in what your invoices print about your company', link: { label: 'Clients', to: { path: '/invoicing', query: { tab: 'clients' } } } })
  }
  return lines
}
