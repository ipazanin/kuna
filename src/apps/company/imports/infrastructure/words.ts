import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  notXml: (fileName: string) => `${fileName} is not well-formed XML, so it cannot be read as a camt.053 statement.`,
  notSpreadsheet: (fileName: string) => `${fileName} could not be read as a spreadsheet. Save it as .xlsx or .csv and try again.`,
}

export const hr: Translation<typeof en> = {
  notXml: (fileName) => `„${fileName}” nije ispravan XML, pa se ne može pročitati kao camt.053 izvod.`,
  notSpreadsheet: (fileName) => `„${fileName}” nije se mogla pročitati kao tablica. Spremite je kao .xlsx ili .csv i pokušajte ponovno.`,
}

export const words = language === 'hr' ? hr : en
