import { language } from '../../../../shared/text/language'
import type { EnglishForms, Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  purpose: "Your company's books from its bank statements: cash, invoices, taxes and the year end.",
  cashOnHand: 'Cash on hand',
  toReview: (count: number): EnglishForms => ({ one: `${count} row to review`, other: `${count} rows to review` }),
}

export const hr: Translation<typeof en> = {
  purpose: 'Financije vaše tvrtke iz bankovnih izvoda: novac, računi, porezi i kraj godine.',
  cashOnHand: 'Novac na računima',
  toReview: (count) => ({ one: `${count} stavka za provjeru`, few: `${count} stavke za provjeru`, other: `${count} stavki za provjeru` }),
}

export const words = language === 'hr' ? hr : en
