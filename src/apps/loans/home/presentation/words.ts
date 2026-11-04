import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  purpose: 'Your loans in a file of their own: bank loans with their payment plan, and loans between people.',
  owed: 'You owe in all',
  owedToYou: 'Owed to you',
  nextPayment: (amount: string, caption: string) => `Next ${amount}: ${caption}`,
}

export const hr: Translation<typeof en> = {
  purpose: 'Vaši krediti u zasebnoj datoteci: krediti banaka s otplatnim planom i pozajmice među ljudima.',
  owed: 'Ukupno dugujete',
  owedToYou: 'Duguje vam se',
  nextPayment: (amount, caption) => `Sljedeća rata ${amount}: ${caption}`,
}

export const words = language === 'hr' ? hr : en
