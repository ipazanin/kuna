import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  description: 'The categories your entries go in, the rules that file your statements, and where the Spending file is kept, with its export and the switch to another place.',
  tabs: { label: 'Parts of the settings', general: 'General', rules: 'Rules' },
  books: 'Spending file',
  localTitle: 'Spending file',
  export: 'Export',
  switchStorage: 'Switch storage',
}

export const hr: Translation<typeof en> = {
  description: 'Kategorije vaših unosa, pravila koja razvrstavaju vaše izvode te gdje se čuva datoteka potrošnje, s izvozom i premještanjem na drugo mjesto.',
  tabs: { label: 'Dijelovi postavki', general: 'Općenito', rules: 'Pravila' },
  books: 'Datoteka potrošnje',
  localTitle: 'Datoteka potrošnje',
  export: 'Izvezi',
  switchStorage: 'Promijeni mjesto',
}

export const words = language === 'hr' ? hr : en
