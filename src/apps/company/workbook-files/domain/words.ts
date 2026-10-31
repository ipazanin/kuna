import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// A tab of the file is list, named as the file names it, such as ledger.

export const en = {
  noLedger: 'The file has no tab called "ledger", so it is not a Kuna workbook.',
}

export const hr: Translation<typeof en> = {
  noLedger: 'Datoteka nema list „ledger”, pa nije Kunina datoteka.',
}

export const words = language === 'hr' ? hr : en
