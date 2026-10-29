import { language } from '../text/language'
import type { Translation } from '../text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  allApps: 'All apps',
}

export const hr: Translation<typeof en> = {
  allApps: 'Sve aplikacije',
}

export const words = language === 'hr' ? hr : en
