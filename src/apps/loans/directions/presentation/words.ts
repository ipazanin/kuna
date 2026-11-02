import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence.

export const en = {
  youOwe: 'You owe',
  owedToYou: 'Owed to you',
}

export const hr: Translation<typeof en> = {
  youOwe: 'Dugujete',
  owedToYou: 'Duguje vam se',
}

export const words = language === 'hr' ? hr : en
