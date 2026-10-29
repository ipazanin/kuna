import { language } from '../../shared/text/language'
import type { Translation } from '../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  name: 'Loans',
}

export const hr: Translation<typeof en> = {
  name: 'Zajmovi',
}

export const words = language === 'hr' ? hr : en
