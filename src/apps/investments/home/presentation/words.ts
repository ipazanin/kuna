import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  purpose: 'Every buy and sale at your brokers in a file of its own, with what it is worth and what it earned.',
}

export const hr: Translation<typeof en> = {
  purpose: 'Svaka kupnja i prodaja kod vaših brokera u zasebnoj datoteci, s vrijednošću i zaradom.',
}

export const words = language === 'hr' ? hr : en
