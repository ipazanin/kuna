import { language } from '../../../../../shared/text/language'
import type { Translation } from '../../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// A city or municipality keeps its official name, such as Grad Zagreb, as the Porezna uprava tables write it.

export const en = {
  /** Why a typed place names no single city or municipality. */
  localUnit: {
    blank: 'name the city or municipality',
    unknown: (typed: string) => `"${typed}" is not a Croatian city or municipality`,
    several: (typed: string, choices: readonly string[]) => `"${typed}" could be ${choices.slice(0, -1).join(', ')} or ${choices.at(-1)}, so choose one`,
  },
}

export const hr: Translation<typeof en> = {
  localUnit: {
    blank: 'navedite grad ili općinu',
    unknown: (typed) => `„${typed}” nije hrvatski grad ni općina`,
    several: (typed, choices) => `„${typed}” može biti ${choices.slice(0, -1).join(', ')} ili ${choices.at(-1)}, pa odaberite jedno`,
  },
}

export const words = language === 'hr' ? hr : en
