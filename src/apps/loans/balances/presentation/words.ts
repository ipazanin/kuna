import { language } from '../../../../shared/text/language'
import type { EnglishForms, Translation } from '../../../../shared/text/translation'
import { monthCase } from '../../../../shared/calendar/monthCase'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  owedSoFar: 'Owed so far',
  stillToCome: 'Still to come, by the plan',
  today: 'Today',
  variableRule: (month: string) => `Variable rate from ${month}`,
  estimate: 'An estimate at the variable rate',
  noMonths: 'No months to show.',
  description: (months: string, now: string, owed: string) => `What the loan owes at each month end, ${months}. At the end of ${now} it is ${owed}.`,
  planDescription: (owed: string, month: string) => ` The plan reaches ${owed} by ${month}.`,
  yourPart: 'Your part',
  yourPartDescription: (owed: string, now: string) => ` The thinner line is your part of what is owed, ${owed} at the end of ${now}.`,
  expected: 'Expected by the plan',
  expectedDescription: (owed: string, now: string) => ` The dashed line is what would be owed at each month end had every instalment of the expected plan been paid, ${owed} at the end of ${now}.`,
  expectedPaidOff: (month: string) => ` By the plan nothing is owed from ${month}.`,
  expectedRunsOn: (owed: string, month: string) => ` By the plan ${owed} is still owed in ${month}, where the chart stops.`,
  lowers: 'Lowers what is owed',
  raises: 'Raises what is owed',
  rateChange: 'Rate change',
  moveAmount: (kind: string, amount: string) => `${kind} ${amount}`,
  moreMoves: (count: number, amount: string): EnglishForms => ({ one: `and 1 more, ${amount}`, other: `and ${count} more, ${amount} in all` }),
  movesDescription: (count: number, marks: string): EnglishForms => ({
    one: ` A dot marks the one movement on its month: ${marks}.`,
    other: ` Dots mark the ${count} movements on their months: ${marks}.`,
  }),
  lowersMark: 'what lowers the debt',
  raisesMark: 'what raises the debt',
  rateMark: 'a new rate as a ring',
  oneDotAMonth: ' A month’s movements of one kind share a dot.',
}

export const hr: Translation<typeof en> = {
  owedSoFar: 'Dug do sada',
  stillToCome: 'Tek dolazi, prema otplatnom planu',
  today: 'Danas',
  variableRule: (month) => `Promjenjiva kamatna stopa od ${monthCase(month, 'genitive')}`,
  estimate: 'Procjena po promjenjivoj kamatnoj stopi',
  noMonths: 'Nema mjeseci za prikaz.',
  description: (months, now, owed) => `Dug na kraju svakog mjeseca, razdoblje ${months} Na kraju ${monthCase(now, 'genitive')} dug iznosi ${owed}.`,
  planDescription: (owed, month) => ` Prema otplatnom planu do kraja razdoblja ${month} pada na ${owed}.`,
  yourPart: 'Vaš dio',
  yourPartDescription: (owed, now) => ` Tanja linija je vaš dio duga, ${owed} na kraju ${monthCase(now, 'genitive')}.`,
  expected: 'Očekivano prema planu',
  expectedDescription: (owed, now) =>
    ` Isprekidana linija prikazuje koliko bi se dugovalo na kraju svakog mjeseca da je plaćena svaka rata očekivanog plana. Na kraju ${monthCase(now, 'genitive')} to je ${owed}.`,
  expectedPaidOff: (month) => ` Prema planu od razdoblja ${month} nema duga.`,
  expectedRunsOn: (owed, month) => ` Prema planu dug u razdoblju ${month}, gdje grafikon završava, još iznosi ${owed}.`,
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
  lowersMark: 'ono što smanjuje dug',
  raisesMark: 'ono što povećava dug',
  rateMark: 'nova kamatna stopa kao prsten',
  oneDotAMonth: ' Promjene iste vrste u jednom mjesecu dijele točku.',
}

export const words = language === 'hr' ? hr : en
