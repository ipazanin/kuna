import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// Mail is pošta and one mail poruka.

export const en = {
  statements: {
    notCamt: 'It is not a camt.053 statement with a creation day and a number.',
  },
}

export const hr: Translation<typeof en> = {
  statements: {
    notCamt: 'Nije camt.053 izvod s danom izrade i brojem.',
  },
}

export const words = language === 'hr' ? hr : en
