import { en as googleEnglish, hr as googleCroatian } from '../../../../shared/google/words'
import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// A folder's own name and a setting's key, such as statements_folder, stay as Drive and the file write them.

export const en = {
  notXml: (fileName: string) => `${fileName} is not well-formed XML, so it cannot be read as a camt.053 statement.`,
  notSpreadsheet: (fileName: string) => `${fileName} could not be read as a spreadsheet. Save it as .xlsx or .csv and try again.`,
  noFolder: (where: string, name: string) => `${googleEnglish.noFolder(where, name)}, so no statements were read. Check the statements_folder setting.`,
  severalFolders: (where: string, count: number, name: string) =>
    `${googleEnglish.severalFolders(where, count, name)}, so the app cannot tell which one holds the statements. Rename or remove the others in Drive.`,
}

export const hr: Translation<typeof en> = {
  notXml: (fileName) => `„${fileName}” nije ispravan XML, pa se ne može pročitati kao camt.053 izvod.`,
  notSpreadsheet: (fileName) => `„${fileName}” nije se mogla pročitati kao tablica. Spremite je kao .xlsx ili .csv i pokušajte ponovno.`,
  noFolder: (where, name) => `${googleCroatian.noFolder(where, name)}, pa nijedan izvod nije pročitan. Provjerite postavku statements_folder.`,
  severalFolders: (where, count, name) => `${googleCroatian.severalFolders(where, count, name)}, pa aplikacija ne zna u kojoj su izvodi. Preimenujte ili uklonite ostale na Driveu.`,
}

export const words = language === 'hr' ? hr : en
