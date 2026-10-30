import { language } from '../../shared/text/language'
import type { Translation } from '../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// The app is Ulaganja, and its file is datoteka ulaganja.

export const en = {
  name: 'Investments',
  start: 'Start',
  pickFile: 'Pick your Investments file',
}

export const hr: Translation<typeof en> = {
  name: 'Ulaganja',
  start: 'Početak',
  pickFile: 'Odaberite datoteku ulaganja',
}

export const words = language === 'hr' ? hr : en
