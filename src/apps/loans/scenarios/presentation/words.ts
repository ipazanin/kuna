import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. A bank loan is kredit and its equal monthly payment anuitet.
// An extra payment is prijevremena otplata, a scenario scenarij and a move to another bank prelazak u drugu banku.

export const en = {
  asItStands: 'As it stands',
  groups: { instalments: 'Instalments', costs: 'What it costs' },
  lines: {
    nextInstalment: 'Next instalment',
    highestInstalment: 'Highest instalment',
    afterMove: 'Instalment after the move',
    instalmentsLeft: 'Instalments left',
    instalmentsInAll: 'Instalments in all',
    payoff: 'Paid off',
    interestLeft: 'Interest left',
    interest: 'Interest',
    extra: 'Extra you put in',
    costs: 'Costs',
    /** Who pays the subsidy, or the subsidy itself when the loan does not say. */
    subsidyPays: (payer: string) => (payer === '' ? 'Subsidy pays' : `${payer} pays`),
    total: 'You pay in all',
  },
  /** How much sooner or later a scenario is paid off, such as "2 y 7 m sooner". */
  span: { years: (count: number) => `${count} y`, months: (count: number) => `${count} m`, sooner: (span: string) => `${span} sooner`, later: (span: string) => `${span} later` },
  refusals: {
    notADueDate: (day: string, loan: string) => `${day} is not a due date of ${loan}.`,
    rateSharesDay: (day: string) => `Two rate changes start on ${day}.`,
    noFirstRate: (day: string) => `No rate starts at the first instalment on ${day}.`,
    moveNotBeforePayoff: (day: string) => `The loan is paid off by ${day}, so it cannot move then.`,
    twoMoves: 'A scenario moves to another bank once at most.',
  },
  charts: {
    /** The entries are whole sentences, one per scenario. */
    owedDescription: (entries: string) => `What each scenario owes at each month end. ${entries}`,
    owedEntry: (letter: string, name: string, payoff: string) => `${letter}, ${name}, is paid off in ${payoff}.`,
    interestDescription: (fromToday: boolean, entries: string) => `${fromToday ? 'The interest you pay from today' : 'The interest you pay over the loan'}, added up month by month. ${entries}`,
    interestEntry: (letter: string, name: string, total: string) => `${letter}, ${name}, comes to ${total}.`,
  },
}

export const hr: Translation<typeof en> = {
  asItStands: 'Kako je sada',
  groups: { instalments: 'Anuiteti', costs: 'Koliko košta' },
  lines: {
    nextInstalment: 'Sljedeći anuitet',
    highestInstalment: 'Najviši anuitet',
    afterMove: 'Anuitet nakon prelaska',
    instalmentsLeft: 'Preostali anuiteti',
    instalmentsInAll: 'Ukupno anuiteta',
    payoff: 'Otplaćen',
    interestLeft: 'Preostala kamata',
    interest: 'Kamata',
    extra: 'Vaše prijevremene otplate',
    costs: 'Troškovi',
    subsidyPays: (payer) => (payer === '' ? 'Subvencija plaća' : `${payer} plaća`),
    total: 'Ukupno plaćate',
  },
  span: { years: (count) => `${count} g.`, months: (count) => `${count} mj.`, sooner: (span) => `${span} ranije`, later: (span) => `${span} kasnije` },
  refusals: {
    notADueDate: (day, loan) => `${day} nije dospijeće kredita „${loan}”.`,
    rateSharesDay: (day) => `Dvije promjene kamatne stope počinju ${day}.`,
    noFirstRate: (day) => `Nijedna kamatna stopa ne počinje s prvim anuitetom ${day}.`,
    moveNotBeforePayoff: (day) => `Kredit je otplaćen do ${day}, pa tada ne može prijeći u drugu banku.`,
    twoMoves: 'Scenarij prelazi u drugu banku najviše jednom.',
  },
  charts: {
    owedDescription: (entries) => `Dug svakog scenarija na kraju svakog mjeseca. ${entries}`,
    owedEntry: (letter, name, payoff) => `${letter} (${name}), kraj otplate: ${payoff}.`,
    interestDescription: (fromToday, entries) => `${fromToday ? 'Kamata koju plaćate od danas' : 'Kamata koju plaćate kroz cijeli kredit'}, zbrojena iz mjeseca u mjesec. ${entries}`,
    interestEntry: (letter, name, total) => `${letter} (${name}): ${total}.`,
  },
}

export const words = language === 'hr' ? hr : en
