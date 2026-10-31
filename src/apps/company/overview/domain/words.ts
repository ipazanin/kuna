import { language } from '../../../../shared/text/language'
import type { EnglishForms, Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  /** How long the cash lasts, the way a person says it. */
  runway: {
    underAMonth: 'less than a month',
    aboutAMonth: 'about a month',
    aboutMonths: (count: number): EnglishForms => ({ one: `about ${count} month`, other: `about ${count} months` }),
    aboutYears: (count: number): EnglishForms => ({ one: `about ${count} year`, other: `about ${count} years` }),
  },
}

export const hr: Translation<typeof en> = {
  runway: {
    underAMonth: 'manje od mjesec dana',
    aboutAMonth: 'oko mjesec dana',
    aboutMonths: (count) => ({ one: `oko ${count} mjeseca`, few: `oko ${count} mjeseca`, other: `oko ${count} mjeseci` }),
    aboutYears: (count) => ({ one: `oko ${count} godine`, few: `oko ${count} godine`, other: `oko ${count} godina` }),
  },
}

export const words = language === 'hr' ? hr : en
