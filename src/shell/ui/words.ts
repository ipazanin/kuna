import { language } from '../../shared/text/language'
import type { EnglishForms, Translation } from '../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  navigation: {
    sidebar: 'Application',
    open: 'Open navigation',
    label: 'Screens',
    waiting: (count: number): EnglishForms => ({ one: `, ${count} waiting`, other: `, ${count} waiting` }),
  },
}

export const hr: Translation<typeof en> = {
  navigation: {
    sidebar: 'Aplikacija',
    open: 'Otvori izbornik',
    label: 'Zasloni',
    waiting: (count) => ({ one: `, ${count} čeka`, few: `, ${count} čekaju`, other: `, ${count} čeka` }),
  },
}

export const words = language === 'hr' ? hr : en
