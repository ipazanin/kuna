import { describe, expect, it } from 'vitest'

import { en as analysisWords } from '../src/apps/company/analysis/presentation/words'
import { en as categoryWords } from '../src/apps/company/categories/presentation/words'
import { en as invoicingWords } from '../src/apps/company/invoicing/presentation/words'
import { en as overviewWords } from '../src/apps/company/overview/presentation/words'
import { en as settingsWords } from '../src/apps/company/settings/presentation/words'
import { en as sortingWords } from '../src/apps/company/sorting/presentation/words'
import { en as transactionWords } from '../src/apps/company/transactions/presentation/words'
import { CORE_TABS } from '../src/apps/company/workbook/infrastructure/spreadsheetTab'
import { templateColumns } from '../src/apps/company/workbook/infrastructure/workbookTemplate'
import type { CoreTab } from '../src/apps/company/workbook/infrastructure/workbookSnapshot'

/** The names Company's screens, tabs and cards go by, which move while a file made today keeps its notes. */
const SCREEN_NAMES = [
  overviewWords.title,
  transactionWords.title,
  transactionWords.tabs.review,
  transactionWords.tabs.import,
  sortingWords.title,
  categoryWords.categoriesToSort.title,
  invoicingWords.title,
  analysisWords.title,
  settingsWords.title,
  settingsWords.tabNames.general,
  settingsWords.tabNames.accounts,
  settingsWords.tabNames.assistant,
  settingsWords.booksFile,
]

describe("the notes on a new file's headers", () => {
  it('name the record a column holds, never the screen that edits it', () => {
    const named = (Object.keys(CORE_TABS) as CoreTab[]).flatMap((tab) =>
      templateColumns(tab).flatMap((column) => SCREEN_NAMES.filter((name) => new RegExp(`\\b${name}\\b`).test(column.note)).map((name) => `${tab}.${column.name}: ${name}`)),
    )
    expect(named).toEqual([])
  })
})
