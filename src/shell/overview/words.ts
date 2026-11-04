import { language } from '../../shared/text/language'
import { listInWords } from '../../shared/text/listInWords'
import type { Translation } from '../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  title: 'Overview',
  description: 'Your money across Loans, Investments and Assets, and what the company could pay you.',
  net: 'What you own less what you owe',
  leavesOut: (more: readonly string[]) => `Leaves out bank accounts, which no app keeps yet${more.length === 0 ? '' : `, and ${listInWords(more)}`}.`,
  notSetUp: (app: string) => `Not set up: ${app}`,
  failed: (apps: readonly string[]) => `${listInWords(apps)} did not open, so nothing is added up.`,
  nothing: (apps: readonly string[]) => `Nothing to add up until an app is set up: ${listInWords(apps, 'or')}.`,
  currencies: 'Not added up: the apps keep different currencies.',
  apart: 'The company’s money, kept apart from the sum',
}

export const hr: Translation<typeof en> = {
  title: 'Pregled',
  description: 'Vaš novac u Kreditima, Ulaganjima i Imovini te što vam tvrtka može isplatiti.',
  net: 'Imovina umanjena za dugove',
  leavesOut: (more) => `Ne uključuje bankovne račune, koje još nijedna aplikacija ne vodi${more.length === 0 ? '' : `, ni ${listInWords(more)}`}.`,
  notSetUp: (app) => `Nije postavljeno: ${app}`,
  failed: (apps) =>
    apps.length === 1 ? `Datoteka aplikacije ${listInWords(apps)} nije se otvorila, pa se ništa ne zbraja.` : `Datoteke aplikacija ${listInWords(apps)} nisu se otvorile, pa se ništa ne zbraja.`,
  nothing: (apps) => `Nema što zbrojiti dok ne postavite aplikaciju: ${listInWords(apps, 'or')}.`,
  currencies: 'Nije zbrojeno: aplikacije vode različite valute.',
  apart: 'Novac tvrtke, izvan zbroja',
}

export const words = language === 'hr' ? hr : en
