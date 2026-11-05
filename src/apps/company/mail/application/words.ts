import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// Mail is pošta and one mail poruka. Filing an attachment saves it into its Drive folder, so it is spremiti.

export const en = {
  statements: {
    label: 'Bank statements',
    notCamt: 'It is not a camt.053 statement with a creation day and a number.',
  },
}

export const hr: Translation<typeof en> = {
  statements: {
    label: 'Bankovni izvodi',
    notCamt: 'Nije camt.053 izvod s danom izrade i brojem.',
  },
}

export const words = language === 'hr' ? hr : en
