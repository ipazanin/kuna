import { language } from '../../shared/text/language'
import { listInWords } from '../../shared/text/listInWords'
import type { Translation } from '../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  title: 'Net worth',
  net: 'What you have less what you owe',
  has: 'What you have',
  owes: 'What you owe',
  /** What a part's bar says to a screen reader: its share of the larger side, which sets the scale of every bar. */
  shareOfHas: (share: string) => `${share} of what you have`,
  shareOfOwes: (share: string) => `${share} of what you owe`,
  leavesOut: (notes: readonly string[]) => (notes.length === 0 ? '' : `Leaves out ${listInWords(notes)}.`),
  notSetUp: (app: string) => `Not set up: ${app}`,
  failed: (apps: readonly string[]) => `${listInWords(apps)} did not open, so nothing is added up.`,
  nothing: 'Nothing to add up until an app is set up.',
  currencies: 'Not added up: the apps keep different currencies.',
  apart: 'The company’s money, kept apart from the sum',
}

export const hr: Translation<typeof en> = {
  title: 'Neto imovina',
  net: 'Što imate, umanjeno za ono što dugujete',
  has: 'Što imate',
  owes: 'Što dugujete',
  shareOfHas: (share) => `${share} onoga što imate`,
  shareOfOwes: (share) => `${share} onoga što dugujete`,
  leavesOut: (notes) => (notes.length === 0 ? '' : `Ne uključuje ${listInWords(notes)}.`),
  notSetUp: (app) => `Nije postavljeno: ${app}`,
  failed: (apps) =>
    apps.length === 1 ? `Datoteka aplikacije ${listInWords(apps)} nije se otvorila, pa se ništa ne zbraja.` : `Datoteke aplikacija ${listInWords(apps)} nisu se otvorile, pa se ništa ne zbraja.`,
  nothing: 'Nema što zbrojiti dok ne postavite neku aplikaciju.',
  currencies: 'Nije zbrojeno: aplikacije vode različite valute.',
  apart: 'Novac tvrtke, izvan zbroja',
}

export const words = language === 'hr' ? hr : en
