import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  title: 'Settings',
  description: 'Where the Loans file is kept, with its export and the switch to another place.',
}

export const hr: Translation<typeof en> = {
  title: 'Postavke',
  description: 'Gdje se čuva datoteka zajmova, s izvozom i premještanjem na drugo mjesto.',
}

export const words = language === 'hr' ? hr : en
