import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  purpose: 'Your loans in a file of their own: bank loans with their payment plan, and loans between people.',
  owed: 'You owe in all',
  owedToYou: 'Owed to you',
}

export const hr: Translation<typeof en> = {
  purpose: 'Vaši zajmovi u zasebnoj datoteci: bankovni krediti s otplatnim planom i zajmovi među ljudima.',
  owed: 'Ukupno dugujete',
  owedToYou: 'Duguju vama',
}

export const words = language === 'hr' ? hr : en
