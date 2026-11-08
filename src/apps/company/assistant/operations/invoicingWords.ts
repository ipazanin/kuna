import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  fields: {
    deliveryPeriod: 'Work period',
    invoicing: 'Invoice details',
  },
  reverseCharge: 'reverse charge',
}

export const hr: Translation<typeof en> = {
  fields: {
    deliveryPeriod: 'Razdoblje rada',
    invoicing: 'Podaci za račun',
  },
  reverseCharge: 'prijenos porezne obveze',
}

export const words = language === 'hr' ? hr : en
