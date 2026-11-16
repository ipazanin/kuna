import { language } from '../text/language'
import type { Translation } from '../text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  incomplete: 'Incomplete month, figures so far',
  noData: 'no data',
  swatches: {
    green: 'Green',
    orange: 'Orange',
    blue: 'Blue',
    ochre: 'Ochre',
    pink: 'Pink',
    darkGreen: 'Dark green',
    violet: 'Violet',
    red: 'Red',
    teal: 'Teal',
    plum: 'Plum',
    olive: 'Olive',
    petrol: 'Petrol',
    grey: 'Grey',
  },
  ownColour: (hex: string) => `Own colour ${hex.toUpperCase()}`,
}

export const hr: Translation<typeof en> = {
  incomplete: 'Mjesec još traje, brojke do sada',
  noData: 'nema podataka',
  swatches: {
    green: 'Zelena',
    orange: 'Narančasta',
    blue: 'Plava',
    ochre: 'Oker',
    pink: 'Ružičasta',
    darkGreen: 'Tamnozelena',
    violet: 'Ljubičasta',
    red: 'Crvena',
    teal: 'Tirkizna',
    plum: 'Boja šljive',
    olive: 'Maslinasta',
    petrol: 'Petrolej',
    grey: 'Siva',
  },
  ownColour: (hex) => `Vlastita boja ${hex.toUpperCase()}`,
}

export const words = language === 'hr' ? hr : en
