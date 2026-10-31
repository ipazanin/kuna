import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// The billing plan is plan naplate and its row stavka plana. A description becomes an invoice line, so it is never translated.

export const en = {
  /** Why "Fill the rest of the year" has nothing to add. */
  fill: {
    noClient: 'Choose the client the rows are for first.',
    noTerms: 'Set the monthly fee or the monthly subscription, each with its item, first.',
  },
}

export const hr: Translation<typeof en> = {
  fill: {
    noClient: 'Najprije odaberite klijenta za kojeg su stavke.',
    noTerms: 'Najprije postavite mjesečnu naknadu ili mjesečnu pretplatu, svaku s njezinom stavkom.',
  },
}

export const words = language === 'hr' ? hr : en
