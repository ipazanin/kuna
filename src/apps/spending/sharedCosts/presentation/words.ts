import { language } from '../../../../shared/text/language'
import type { CroatianForms, EnglishForms, Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative.
// A shared cost is zajednički trošak, which is masculine. An entry is unos, also masculine.

export const en = {
  sharedCosts: 'Shared costs',
  make: 'Make a shared cost',
  row: {
    entries: (count: number): EnglishForms => ({ one: '1 entry', other: `${count} entries` }),
    settled: 'Settled',
    notRated: 'Counts once the rates reach every day',
  },
  dialog: {
    makeTitle: 'Make a shared cost',
    title: 'Shared cost',
    description: 'Money several entries make together, such as a gift paid in three shops that friends paid back. It counts what its entries add up to on its own day, and they count nowhere else.',
    day: 'Day',
    category: 'Category',
    pickCategory: 'Pick a category',
    note: 'Note',
    settled: 'Settled',
    settledHelp: 'Nobody owes anything more on it. A settled one is no longer offered for a new entry, and counts as before.',
    entries: 'Its entries',
    takeOut: (entry: string) => `Take ${entry} out`,
    counts: (amount: string, category: string) => `Counts ${amount} under ${category}`,
    countsAmount: (amount: string) => `Counts ${amount}`,
    movesFrom: (sharedCost: string) => `Moves here from ${sharedCost}`,
    notRated: 'It counts once the exchange rates reach the day of each of its entries.',
    delete: 'Delete',
    make: 'Make',
    save: 'Save',
    made: 'Shared cost made',
    saved: 'Shared cost saved',
    deleted: (count: number): EnglishForms => ({ one: 'Shared cost deleted. Its entry waits on To review', other: `Shared cost deleted. Its ${count} entries wait on To review` }),
    takenOut: 'Taken out of the shared cost',
    linked: 'An entry linked to a record in another app counts there. Unlink it first.',
    transfer: 'A move between your accounts joins no shared cost.',
  },
  joined: 'Put in the shared cost',
  /** Why a part linked to a record in another app takes no shared cost. */
  unlinkFirst: 'Unlink it first, since a linked entry counts in another app',
  mayRepay: (name: string) => `May be a repayment for ${name}`,
  putIn: 'Put it in',
}

export const hr: Translation<typeof en> = {
  sharedCosts: 'Zajednički troškovi',
  make: 'Napravi zajednički trošak',
  row: {
    entries: (count): CroatianForms => ({ one: `${count} unos`, few: `${count} unosa`, other: `${count} unosa` }),
    settled: 'Podmireno',
    notRated: 'Broji se kad tečajevi stignu do svakog dana',
  },
  dialog: {
    makeTitle: 'Napravi zajednički trošak',
    title: 'Zajednički trošak',
    description: 'Novac koji čini više unosa zajedno, poput poklona plaćenog u tri trgovine koji su vam prijatelji vratili. Broji zbroj svojih unosa na svoj dan, a oni se nigdje drugdje ne broje.',
    day: 'Dan',
    category: 'Kategorija',
    pickCategory: 'Odaberi kategoriju',
    note: 'Bilješka',
    settled: 'Podmireno',
    settledHelp: 'Nitko na njemu više ništa ne duguje. Podmireni se više ne nudi za novi unos, a broji se kao i prije.',
    entries: 'Njegovi unosi',
    takeOut: (entry) => `Izvadi ${entry}`,
    counts: (amount, category) => `Broji ${amount} pod ${category}`,
    countsAmount: (amount) => `Broji ${amount}`,
    movesFrom: (sharedCost) => `Prelazi ovamo iz: ${sharedCost}`,
    notRated: 'Broji se kad tečajevi stignu do dana svakog njegovog unosa.',
    delete: 'Obriši',
    make: 'Napravi',
    save: 'Spremi',
    made: 'Zajednički trošak napravljen',
    saved: 'Zajednički trošak spremljen',
    deleted: (count): CroatianForms => ({
      one: `Zajednički trošak obrisan. Njegov ${count} unos čeka pod Za pregled`,
      few: `Zajednički trošak obrisan. Njegova ${count} unosa čekaju pod Za pregled`,
      other: `Zajednički trošak obrisan. Njegovih ${count} unosa čeka pod Za pregled`,
    }),
    takenOut: 'Izvađeno iz zajedničkog troška',
    linked: 'Unos povezan sa zapisom u drugoj aplikaciji broji se tamo. Prvo ga odvežite.',
    transfer: 'Prijenos između vaših računa ne ide u zajednički trošak.',
  },
  joined: 'Stavljeno u zajednički trošak',
  unlinkFirst: 'Prvo ga odvežite, jer se povezani unos broji u drugoj aplikaciji',
  mayRepay: (name) => `Možda je povrat za ${name}`,
  putIn: 'Stavi u trošak',
}

export const words = language === 'hr' ? hr : en
