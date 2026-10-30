import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// The Investments file is datoteka ulaganja in Croatian.

export const en = {
  title: 'Settings',
  description: 'Where the Investments file is kept, with its export and the switch to another place, and where its prices come from.',
  books: 'Investments books',
  localTitle: 'Investments file',
  export: 'Export',
  switchStorage: 'Switch storage',
}

export const hr: Translation<typeof en> = {
  title: 'Postavke',
  description: 'Gdje se čuva datoteka ulaganja, s izvozom i premještanjem na drugo mjesto, te odakle dolaze njezine cijene.',
  books: 'Datoteka ulaganja',
  localTitle: 'Datoteka ulaganja',
  export: 'Izvezi',
  switchStorage: 'Promijeni mjesto',
}

export const words = language === 'hr' ? hr : en
