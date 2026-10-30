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
  update: {
    ready: 'A new version of Kuna is ready.',
    reload: 'Reload',
  },
  /** The apps whose books in this browser hold changes in no exported file, counted, such as "The Loans books". */
  unexported: (_count: number, apps: string): EnglishForms => ({
    one: `The ${apps} books in this browser hold changes in no exported file.`,
    other: `The ${apps} books in this browser hold changes in no exported file.`,
  }),
}

export const hr: Translation<typeof en> = {
  navigation: {
    sidebar: 'Aplikacija',
    open: 'Otvori izbornik',
    label: 'Zasloni',
    waiting: (count) => ({ one: `, ${count} čeka`, few: `, ${count} čekaju`, other: `, ${count} čeka` }),
  },
  update: {
    ready: 'Spremna je nova inačica Kune.',
    reload: 'Ponovno učitaj',
  },
  unexported: (_count, apps) => ({
    one: `Datoteka aplikacije ${apps} u ovom pregledniku ima promjene kojih nema ni u jednoj izvezenoj datoteci.`,
    few: `Datoteke aplikacija ${apps} u ovom pregledniku imaju promjene kojih nema ni u jednoj izvezenoj datoteci.`,
    other: `Datoteke aplikacija ${apps} u ovom pregledniku imaju promjene kojih nema ni u jednoj izvezenoj datoteci.`,
  }),
}

export const words = language === 'hr' ? hr : en
