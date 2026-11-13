import { language } from '../../shared/text/language'
import type { EnglishForms, Translation } from '../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  opening: 'Opening the books',
  navigation: {
    sidebar: 'Application',
    open: 'Open navigation',
    label: 'Screens',
    pages: (app: string) => `Pages of ${app}`,
    addApp: 'Add an app',
    waiting: (count: number): EnglishForms => ({ one: `, ${count} waiting`, other: `, ${count} waiting` }),
    skip: 'Skip to content',
  },
  sidebarLayout: {
    name: 'Sidebar layout',
    expanded: 'Expanded',
    icons: 'Icons',
    hidden: 'Hidden',
    /** What a choice says in the menu where picking it changes something, by what it changes. */
    effects: {
      'wider-window': 'Shows in a wider window',
      'chat-takes-page': "The chat moves into the page's place",
      'chat-beside-page': 'The chat moves beside the page',
    },
  },
  quickJump: {
    title: 'Jump to a page',
    placeholder: 'Search pages',
    kuna: 'Kuna',
    openChat: 'Open the chat',
    nothing: 'No page has that name',
  },
  chatWidth: 'Chat width',
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
  opening: 'Datoteke se otvaraju',
  navigation: {
    sidebar: 'Aplikacija',
    open: 'Otvori izbornik',
    label: 'Zasloni',
    pages: (app) => `Stranice aplikacije ${app}`,
    addApp: 'Dodaj aplikaciju',
    waiting: (count) => ({ one: `, ${count} čeka`, few: `, ${count} čekaju`, other: `, ${count} čeka` }),
    skip: 'Preskoči na sadržaj',
  },
  sidebarLayout: {
    name: 'Prikaz bočne trake',
    expanded: 'Proširena',
    icons: 'Ikone',
    hidden: 'Skrivena',
    effects: {
      'wider-window': 'Prikazuje se u širem prozoru',
      'chat-takes-page': 'Razgovor prelazi na mjesto stranice',
      'chat-beside-page': 'Razgovor prelazi uz stranicu',
    },
  },
  quickJump: {
    title: 'Idi na stranicu',
    placeholder: 'Pretraži stranice',
    kuna: 'Kuna',
    openChat: 'Otvori razgovor',
    nothing: 'Nijedna stranica nema taj naziv',
  },
  chatWidth: 'Širina razgovora',
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
