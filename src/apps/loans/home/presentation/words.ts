import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

function nextBankPayment(amount: string, day: string, loan: string): string {
  return `Next ${amount}, ${day}, ${loan}`
}

export const en = {
  purpose: 'Your loans: bank loans with their payment plan, and loans between people.',
  owed: 'You owe in all',
  owedToYou: 'Owed to you',
  nextPayment: {
    annuity: nextBankPayment,
    'equal-principal': nextBankPayment,
    informal: (amount: string, day: string, payee: string) => `Next ${amount}, ${day}, repaying ${payee}`,
  },
  overduePayment: (amount: string, payee: string) => `Overdue ${amount}, repaying ${payee}`,
}

export const hr: Translation<typeof en> = {
  purpose: 'Vaši krediti: krediti banaka s otplatnim planom i pozajmice među ljudima.',
  owed: 'Ukupno dugujete',
  owedToYou: 'Duguje vam se',
  nextPayment: {
    annuity: (amount, day, loan) => `Sljedeći anuitet ${amount}, ${day}, ${loan}`,
    'equal-principal': (amount, day, loan) => `Sljedeća rata ${amount}, ${day}, ${loan}`,
    informal: (amount, day, payee) => `Sljedeći obrok ${amount}, ${day}, vraćate: ${payee}`,
  },
  overduePayment: (amount, payee) => `Kasnite s obrokom ${amount}: ${payee}`,
}

export const words = language === 'hr' ? hr : en
