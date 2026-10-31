import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'
import { monthCase } from '../../../../shared/calendar/monthCase'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  owedSoFar: 'Owed so far',
  stillToCome: 'Still to come, by the plan',
  today: 'Today',
  variableFrom: 'Variable rate from here, an estimate',
  estimate: 'An estimate at the variable rate',
  noMonths: 'No months to show.',
  description: (first: string, last: string, now: string, owed: string) => `What the loan owes at each month end from ${first} to ${last}. At the end of ${now} it is ${owed}.`,
  planDescription: (owed: string, month: string) => ` The plan reaches ${owed} by ${month}.`,
}

export const hr: Translation<typeof en> = {
  owedSoFar: 'Dug do sada',
  stillToCome: 'Tek dolazi, prema otplatnom planu',
  today: 'Danas',
  variableFrom: 'Odavde promjenjiva kamatna stopa, procjena',
  estimate: 'Procjena po promjenjivoj kamatnoj stopi',
  noMonths: 'Nema mjeseci za prikaz.',
  description: (first, last, now, owed) => `Dug na kraju svakog mjeseca, razdoblje ${first} – ${last} Na kraju ${monthCase(now, 'genitive')} dug iznosi ${owed}.`,
  planDescription: (owed, month) => ` Prema otplatnom planu do kraja razdoblja ${month} pada na ${owed}.`,
}

export const words = language === 'hr' ? hr : en
