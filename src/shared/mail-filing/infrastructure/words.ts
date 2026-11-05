import { en as googleEnglish, hr as googleCroatian } from '../../google/words'
import { language } from '../../text/language'
import type { Translation } from '../../text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// A folder's own name stays as Drive writes it.

export const en = {
  whichFolder: (where: string, count: number, name: string) => `${googleEnglish.severalFolders(where, count, name)}, so the app cannot tell which one is meant`,
}

export const hr: Translation<typeof en> = {
  whichFolder: (where, count, name) => `${googleCroatian.severalFolders(where, count, name)}, pa aplikacija ne zna na koju se misli`,
}

export const words = language === 'hr' ? hr : en
