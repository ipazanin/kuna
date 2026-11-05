import { language } from '../text/language'
import type { Translation } from '../text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  incomplete: 'Incomplete month, figures so far',
  noData: 'no data',
  swatches: { green: 'Green', orange: 'Orange', blue: 'Blue', amber: 'Amber', pink: 'Pink', darkGreen: 'Dark green', violet: 'Violet', red: 'Red', grey: 'Grey' },
}

export const hr: Translation<typeof en> = {
  incomplete: 'Mjesec još traje, brojke do sada',
  noData: 'nema podataka',
  swatches: { green: 'Zelena', orange: 'Narančasta', blue: 'Plava', amber: 'Jantarna', pink: 'Ružičasta', darkGreen: 'Tamnozelena', violet: 'Ljubičasta', red: 'Crvena', grey: 'Siva' },
}

export const words = language === 'hr' ? hr : en
