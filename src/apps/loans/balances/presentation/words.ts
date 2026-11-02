import { language } from '../../../../shared/text/language'
import type { EnglishForms, Translation } from '../../../../shared/text/translation'
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
  lowers: 'Lowers what is owed',
  raises: 'Raises what is owed',
  rateChange: 'Rate change',
  moveAmount: (kind: string, amount: string) => `${kind} ${amount}`,
  moreMoves: (count: number, amount: string): EnglishForms => ({ one: `and 1 more, ${amount}`, other: `and ${count} more, ${amount} in all` }),
  movesDescription: (count: number, marks: string): EnglishForms => ({
    one: ` A dot marks the one movement on its month: ${marks}.`,
    other: ` Dots mark the ${count} movements on their months: ${marks}.`,
  }),
  lowersMark: 'what lowers the debt as a filled dot',
  raisesMark: 'what raises the debt as a ring',
  rateMark: 'a new rate as a violet ring',
  sizedByAmount: ' A month’s movements of one kind share a dot, sized by what they come to.',
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
  lowers: 'Smanjuje dug',
  raises: 'Povećava dug',
  rateChange: 'Promjena kamatne stope',
  moveAmount: (kind, amount) => `${kind} ${amount}`,
  moreMoves: (count, amount) => ({
    one: count === 1 ? `i još 1, ${amount}` : `i još ${count}, ukupno ${amount}`,
    few: `i još ${count}, ukupno ${amount}`,
    other: `i još ${count}, ukupno ${amount}`,
  }),
  movesDescription: (count, marks) => ({
    one: count === 1 ? ` Točkom je označena jedina promjena u svojem mjesecu: ${marks}.` : ` Točkama je označena ${count} promjena u svojim mjesecima: ${marks}.`,
    few: ` Točkama su označene ${count} promjene u svojim mjesecima: ${marks}.`,
    other: ` Točkama je označeno ${count} promjena u svojim mjesecima: ${marks}.`,
  }),
  lowersMark: 'ono što smanjuje dug kao puna točka',
  raisesMark: 'ono što povećava dug kao prsten',
  rateMark: 'nova kamatna stopa kao ljubičasti prsten',
  sizedByAmount: ' Promjene iste vrste u jednom mjesecu dijele točku, veličinom prema svojem zbroju.',
}

export const words = language === 'hr' ? hr : en
