import { language } from '../../shared/text/language'
import type { Translation } from '../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  language: {
    legend: 'Language',
    browser: 'Browser language',
    note: "Browser language follows this browser's first language. Changing it loads the app again.",
  },
}

export const hr: Translation<typeof en> = {
  language: {
    legend: 'Jezik',
    browser: 'Jezik preglednika',
    note: 'Jezik preglednika slijedi prvi jezik ovog preglednika. Kad promijenite jezik, aplikacija se ponovno učita.',
  },
}

export const words = language === 'hr' ? hr : en
