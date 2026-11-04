import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  title: 'Settings',
  description: 'Where the Assets file is kept, with its export and the switch to another place.',
  books: 'Assets file',
  localTitle: 'Assets file',
  export: 'Export',
  switchStorage: 'Switch storage',
}

export const hr: Translation<typeof en> = {
  title: 'Postavke',
  description: 'Gdje se čuva datoteka imovine, s izvozom i premještanjem na drugo mjesto.',
  books: 'Datoteka imovine',
  localTitle: 'Datoteka imovine',
  export: 'Izvezi',
  switchStorage: 'Promijeni mjesto',
}

export const words = language === 'hr' ? hr : en
