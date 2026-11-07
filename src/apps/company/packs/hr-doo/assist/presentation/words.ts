import { language } from '../../../../../../shared/text/language'
import type { Translation } from '../../../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  explain: {
    title: 'Explain',
    sends: 'how the figure is worked out, its amounts and the rules behind it.',
    checked: (day: string) => `Rules checked on ${day}`,
  },
}

export const hr: Translation<typeof en> = {
  explain: {
    title: 'Objasni',
    sends: 'kako je iznos izračunat, brojke od kojih se sastoji i pravila iza njega.',
    checked: (day) => `Pravila provjerena ${day}`,
  },
}

export const words = language === 'hr' ? hr : en
