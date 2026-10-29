import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

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
  stillToCome: 'Tek dolazi, prema planu',
  today: 'Danas',
  variableFrom: 'Odavde promjenjiva stopa, procjena',
  estimate: 'Procjena po promjenjivoj stopi',
  noMonths: 'Nema mjeseci za prikaz.',
  description: (first: string, last: string, now: string, owed: string) => `Dug na kraju svakog mjeseca od ${first} do ${last}. Na kraju ${now} iznosi ${owed}.`,
  planDescription: (owed: string, month: string) => ` Prema planu pada na ${owed} do ${month}.`,
}

export const words = language === 'hr' ? hr : en
