import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// The tabs share a phone's width, so Over time is kretanje, the word a financial report uses for a trend.

export const en = {
  title: 'Analysis',
  description: 'Where the money goes, and whether it is getting better or worse.',
  tabs: { label: 'Breakdown, over time and compare', breakdown: 'Breakdown', overTime: 'Over time', compare: 'Compare' },
}

export const hr: Translation<typeof en> = {
  title: 'Analiza',
  description: 'Kamo odlazi novac i ide li nabolje ili nagore.',
  tabs: { label: 'Raspodjela, kretanje i usporedba', breakdown: 'Raspodjela', overTime: 'Kretanje', compare: 'Usporedba' },
}

export const words = language === 'hr' ? hr : en
