import { isRevolutExport } from '../statements/domain/revolutStatement'
import type { AppFileFormat } from '../../../shared/app/appContribution'
import { decodedText } from '../../../shared/text/decodedText'
import { readFirstSheet } from '../../../shared/xlsx/sheetGrids'

/** Revolut's export, as a sheet or a CSV, which Spending's own reader takes. */
export const SPENDING_FILE_FORMATS: readonly AppFileFormat[] = [
  {
    name: "Revolut's statement export",
    operation: 'import-statement',
    recognises: async (file) => (file.kind === 'sheet' || file.kind === 'csv') && isRevolutExport(await readFirstSheet(file.kind === 'csv' ? decodedText(file.bytes) : file.bytes.slice().buffer)),
  },
]
