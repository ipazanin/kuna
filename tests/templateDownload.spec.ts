import { describe, expect, it, vi } from 'vitest'

import { DEFAULT_CATEGORY_NAMES } from '../src/apps/company/workbook/infrastructure/emptyWorkbook'
import { readWorkbookFile } from '../src/apps/company/workbook/infrastructure/workbookFile'
import { templateColumnNames } from '../src/apps/company/workbook/infrastructure/workbookTemplate'
import { WORKBOOK_TABS } from '../src/apps/company/workbook/infrastructure/workbookSnapshot'
import { downloadTemplate, previewImport } from '../src/apps/company/workbook/presentation/workbookFiles'
import { XLSX_MIME_TYPE, readEveryTab } from '../src/shared/xlsx/sheetGrids'

const downloads: { readonly contents: unknown; readonly fileName: string; readonly type: string }[] = []

vi.mock('../src/shared/files/downloadFile', () => ({
  downloadFile: (contents: unknown, fileName: string, type: string) => downloads.push({ contents, fileName, type }),
}))

async function downloadedTemplate(): Promise<{ readonly bytes: Uint8Array; readonly fileName: string; readonly type: string }> {
  downloads.length = 0
  await downloadTemplate()
  const [download] = downloads
  if (download === undefined || !(download.contents instanceof Uint8Array)) throw new Error('the template handed the browser no bytes')
  return { bytes: download.contents, fileName: download.fileName, type: download.type }
}

describe('the template download', () => {
  it('hands the browser an xlsx file with every tab and its headers', async () => {
    const { bytes, fileName, type } = await downloadedTemplate()
    const tabs = await readEveryTab(bytes)

    expect(fileName).toBe('kuna-template.xlsx')
    expect(type).toBe(XLSX_MIME_TYPE)
    expect(tabs.map((tab) => tab.name)).toEqual([...WORKBOOK_TABS])
    for (const tab of WORKBOOK_TABS) {
      expect(tabs.find((candidate) => candidate.name === tab)?.grid[0], tab).toEqual(templateColumnNames(tab))
    }
  })

  it('reads back with no tab missing, no rows to fill and nothing the reader refuses', async () => {
    const { bytes, fileName } = await downloadedTemplate()
    const contents = await readWorkbookFile(bytes)
    const preview = await previewImport(new File([bytes.slice()], fileName))

    expect(contents.missingTabs).toEqual([])
    for (const tab of WORKBOOK_TABS.filter((name) => name !== 'categories' && name !== 'settings')) {
      expect(contents.tabs[tab], tab).toEqual([])
    }
    expect(contents.tabs.categories.map((row) => row.cells.category)).toEqual([...DEFAULT_CATEGORY_NAMES])
    expect(contents.tabs.settings.length).toBeGreaterThan(0)
    expect(preview.summary).toMatchObject({ transactionCount: 0, accounts: [], defaultedTabs: [], problems: [], refusal: null })
    expect(preview.counts.map((kind) => kind.name).sort()).toEqual(['categories', 'settings'])
  })
})
