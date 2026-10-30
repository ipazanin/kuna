import { readPortfolioWorkbook } from '../domain/portfolioWorkbook'
import type { WorkbookReading } from '../domain/portfolioWorkbook'
import { readEveryTab } from '../../../../shared/xlsx/sheetGrids'

/** The rows of a portfolio workbook picked as a file, read through Kuna's spreadsheet reader. */
export async function readPortfolioWorkbookFile(bytes: ArrayBuffer | Uint8Array): Promise<WorkbookReading> {
  return readPortfolioWorkbook(await readEveryTab(bytes))
}
