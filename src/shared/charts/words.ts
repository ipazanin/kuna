import { language } from '../text/language'
import type { Translation } from '../text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  incomplete: 'Incomplete month, figures so far',
  noData: 'no data',
}

export const hr: Translation<typeof en> = {
  incomplete: 'Mjesec još traje, brojke do sada',
  noData: 'nema podataka',
}

export const words = language === 'hr' ? hr : en
