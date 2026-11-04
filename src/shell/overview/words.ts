import { language } from '../../shared/text/language'
import { listInWords } from '../../shared/text/listInWords'
import type { Translation } from '../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  title: 'Overview',
  description: 'Your money across Loans and Investments, and what the company could pay you.',
  net: 'Investments less loans',
  leavesOut: (more: readonly string[]) => `Leaves out bank accounts and property, which no app keeps yet${more.length === 0 ? '' : `, and ${listInWords(more)}`}.`,
  notSetUp: (app: string) => `Not set up: ${app}`,
  failed: (apps: readonly string[]) => `${listInWords(apps)} did not open, so nothing is added up.`,
  nothing: 'Nothing to add up until Loans or Investments is set up.',
  currencies: 'Not added up: the apps keep different currencies.',
  apart: 'The company’s money, kept apart from the sum',
}

export const hr: Translation<typeof en> = {
  title: 'Pregled',
  description: 'Vaš novac u Kreditima i Ulaganjima te što vam tvrtka može isplatiti.',
  net: 'Ulaganja umanjena za kredite',
  leavesOut: (more) => `Ne uključuje bankovne račune ni nekretnine, koje još nijedna aplikacija ne vodi${more.length === 0 ? '' : `, ni ${listInWords(more)}`}.`,
  notSetUp: (app) => `Nije postavljeno: ${app}`,
  failed: (apps) =>
    apps.length === 1 ? `Datoteka aplikacije ${listInWords(apps)} nije se otvorila, pa se ništa ne zbraja.` : `Datoteke aplikacija ${listInWords(apps)} nisu se otvorile, pa se ništa ne zbraja.`,
  nothing: 'Nema što zbrojiti dok ne postavite Kredite ili Ulaganja.',
  currencies: 'Nije zbrojeno: aplikacije vode različite valute.',
  apart: 'Novac tvrtke, izvan zbroja',
}

export const words = language === 'hr' ? hr : en
