import { language } from '../../shared/text/language'
import type { Translation } from '../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  name: 'Company',
  /** The line Google's Picker shows above the files. */
  pickFile: 'Pick the file with your books',
}

export const hr: Translation<typeof en> = {
  name: 'Tvrtka',
  pickFile: 'Odaberite datoteku',
}

export const words = language === 'hr' ? hr : en
