import type { Workbook } from '../workbook/domain/workbook'
import type { AppFileFormat } from '../../../shared/app/appContribution'
import { decodedText } from '../../../shared/text/decodedText'
import { readFirstSheet } from '../../../shared/xlsx/sheetGrids'

const IMPORT_STATEMENT = 'import-statement'

/** A camt.053 document's root and its statements, which Company's camt reader takes. */
const CAMT_053 = /<(?:\w+:)?Document\b[^>]*urn:iso:std:iso:20022:tech:xsd:camt\.053\.[\s\S]*<(?:\w+:)?BkToCstmrStmt\b[\s\S]*<(?:\w+:)?Stmt\b/

/** A camt.053 statement, and a sheet or CSV that one of the import profiles saved in the books reads. */
export function companyFileFormats(workbook: () => Workbook | null): readonly AppFileFormat[] {
  return [
    { name: 'ISO 20022 bank statement', operation: IMPORT_STATEMENT, recognises: async (file) => file.kind === 'xml' && CAMT_053.test(decodedText(file.bytes)) },
    {
      name: 'statement sheet a saved import profile reads',
      operation: IMPORT_STATEMENT,
      recognises: async (file) => {
        const profiles = workbook()?.settings.importProfiles ?? []
        if ((file.kind !== 'sheet' && file.kind !== 'csv') || profiles.length === 0) return false
        const { fittingProfiles } = await import('../imports/application/importStatements')
        return fittingProfiles(await readFirstSheet(file.kind === 'csv' ? decodedText(file.bytes) : file.bytes.slice().buffer), profiles).length > 0
      },
    },
  ]
}
