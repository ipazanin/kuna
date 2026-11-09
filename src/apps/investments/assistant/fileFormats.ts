import { readClosesCsv } from '../prices/domain/closesCsv'
import type { AppFileFormat } from '../../../shared/app/appContribution'
import { decodedText } from '../../../shared/text/decodedText'

/** The portfolio workbook, IBKR's Activity Flex report and a CSV of daily closes, which Investments' own readers take. Each reader loads only when a file of its kind comes. */
export const INVESTMENTS_FILE_FORMATS: readonly AppFileFormat[] = [
  {
    name: 'portfolio workbook',
    operation: 'import-workbook',
    recognises: async (file) => {
      if (file.kind !== 'sheet') return false
      const { readPortfolioWorkbookFile } = await import('../imports/application/portfolioWorkbookFile')
      return (await readPortfolioWorkbookFile(file.bytes)).kind !== 'refused'
    },
  },
  {
    name: 'IBKR Activity Flex report',
    operation: 'import-flex-report',
    recognises: async (file) => {
      if (file.kind !== 'xml') return false
      const [{ pickedReport }, { IBKR_FLEX_RECIPE }, { readRecipeFile }] = await Promise.all([
        import('../mail/application/mailReports'),
        import('../mail/domain/ibkrFlexRecipe'),
        import('../../../shared/recipes/infrastructure/recipeFile'),
      ])
      return pickedReport(IBKR_FLEX_RECIPE, file.name, readRecipeFile(IBKR_FLEX_RECIPE, file.bytes.slice().buffer)).kind === 'read'
    },
  },
  { name: 'CSV of daily closes', operation: 'import-closes', recognises: async (file) => file.kind === 'csv' && readClosesCsv(decodedText(file.bytes)).kind !== 'refused' },
]
