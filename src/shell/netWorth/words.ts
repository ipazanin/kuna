import { language } from '../../shared/text/language'
import { listInWords } from '../../shared/text/listInWords'
import type { Translation } from '../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  title: 'Net worth',
  description: 'Your money across Loans, Investments, Assets and Spending, and what the company could pay you.',
  net: 'Net worth',
  leavesOut: (notes: readonly string[]) => (notes.length === 0 ? '' : `Leaves out ${listInWords(notes)}.`),
  notSetUp: (app: string) => `Not set up: ${app}`,
  failed: (apps: readonly string[]) => `${listInWords(apps)} did not open, so nothing is added up.`,
  nothing: (apps: readonly string[]) => `Nothing to add up until an app is set up: ${listInWords(apps, 'or')}.`,
  currencies: 'Not added up: the apps keep different currencies.',
  apart: 'The company’s money, kept apart from the sum',
}

export const hr: Translation<typeof en> = {
  title: 'Neto imovina',
  description: 'Vaš novac u Kreditima, Ulaganjima, Imovini i Potrošnji te što vam tvrtka može isplatiti.',
  net: 'Neto imovina',
  leavesOut: (notes) => (notes.length === 0 ? '' : `Ne uključuje ${listInWords(notes)}.`),
  notSetUp: (app) => `Nije postavljeno: ${app}`,
  failed: (apps) =>
    apps.length === 1 ? `Datoteka aplikacije ${listInWords(apps)} nije se otvorila, pa se ništa ne zbraja.` : `Datoteke aplikacija ${listInWords(apps)} nisu se otvorile, pa se ništa ne zbraja.`,
  nothing: (apps) => `Nema što zbrojiti dok ne postavite aplikaciju: ${listInWords(apps, 'or')}.`,
  currencies: 'Nije zbrojeno: aplikacije vode različite valute.',
  apart: 'Novac tvrtke, izvan zbroja',
}

export const words = language === 'hr' ? hr : en
