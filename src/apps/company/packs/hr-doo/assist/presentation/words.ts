import { language } from '../../../../../../shared/text/language'
import type { Translation } from '../../../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  explain: {
    title: 'Explain',
    sends: 'how the figure is worked out, its amounts and the rules behind it.',
    employees: 'Include figures that name employees',
    employeesNote: (provider: string) => `Left out until you switch this on. Then their names and pay go to ${provider}.`,
    checked: (day: string) => `Rules checked on ${day}`,
  },
}

export const hr: Translation<typeof en> = {
  explain: {
    title: 'Objasni',
    sends: 'kako je iznos izračunat, brojke od kojih se sastoji i pravila iza njega.',
    employees: 'Uključi iznose koji navode zaposlenike',
    employeesNote: (provider) => `Izostavljeno dok ovo ne uključite. Tada njihova imena i plaće idu tvrtki ${provider}.`,
    checked: (day) => `Pravila provjerena ${day}`,
  },
}

export const words = language === 'hr' ? hr : en
