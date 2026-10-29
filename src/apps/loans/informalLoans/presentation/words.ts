import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  informalLoan: 'Informal loan',
  allLoans: 'All loans',
  noPlan: 'No interest and no fixed plan',
  changeLoan: 'Change loan',
  addMovement: 'Add movement',
  missing: 'The Loans file holds no informal loan by this link. It may have been deleted.',
  kinds: { borrowed: 'Borrowed', 'borrowed-in-kind': 'Borrowed in kind', repaid: 'Repaid', 'repaid-in-kind': 'Repaid in kind', forgiven: 'Forgiven' },
  youOwe: 'You owe',
  theyOweYou: 'They owe you',
  hero: {
    youOweName: (name: string) => (name === '' ? 'You owe' : `You owe ${name}`),
    nameOwesYou: (name: string) => (name === '' ? 'They owe you' : `${name} owes you`),
    atTheEnd: (day: string) => `At the end of ${day}`,
    settled: 'Nobody owes anything',
    opening: 'Opening balance',
    raised: 'Borrowed since',
    repaid: 'Repaid',
    forgiven: 'Forgiven',
  },
  tiles: {
    lastMovement: 'Last movement',
    noneYet: 'None yet',
    startedOn: (day: string) => `Started on ${day}`,
    kindOn: (kind: string, day: string) => `${kind} on ${day}`,
    since: 'Since',
    movements: (count: number) => ({ one: '1 movement', other: `${count} movements` }),
  },
  balance: {
    title: 'Owed over time',
    subtitle: 'What you owe at each month end. Below zero, they owe you.',
  },
  movements: {
    title: 'Movements',
    subtitle: 'Newest first, with what you owe after each.',
    summary: (count: number) => ({ one: '1 movement', other: `${count} movements` }),
    none: (amount: string) => `No movements yet. The loan owes its opening balance of ${amount}.`,
    change: (day: string) => `Change the movement of ${day}`,
  },
}

export const hr: Translation<typeof en> = {
  informalLoan: 'Zajam među ljudima',
  allLoans: 'Svi zajmovi',
  noPlan: 'Bez kamate i fiksnog plana',
  changeLoan: 'Uredi zajam',
  addMovement: 'Dodaj promjenu',
  missing: 'Datoteka zajmova nema zajam s ovom poveznicom. Možda je obrisan.',
  kinds: { borrowed: 'Posuđeno', 'borrowed-in-kind': 'Posuđeno u naravi', repaid: 'Vraćeno', 'repaid-in-kind': 'Vraćeno u naravi', forgiven: 'Oprošteno' },
  youOwe: 'Dugujete',
  theyOweYou: 'Duguju vama',
  hero: {
    youOweName: (name: string) => (name === '' ? 'Dugujete' : `Dugujete: ${name}`),
    nameOwesYou: (name: string) => (name === '' ? 'Duguju vama' : `${name} vam duguje`),
    atTheEnd: (day: string) => `Na kraju dana ${day}`,
    settled: 'Nitko nikome ne duguje',
    opening: 'Početni dug',
    raised: 'Posuđeno nakon toga',
    repaid: 'Vraćeno',
    forgiven: 'Oprošteno',
  },
  tiles: {
    lastMovement: 'Zadnja promjena',
    noneYet: 'Još nema',
    startedOn: (day: string) => `Početak ${day}`,
    kindOn: (kind: string, day: string) => `${kind}, ${day}`,
    since: 'Od',
    movements: (count: number) => ({ one: `${count} promjena`, few: `${count} promjene`, other: `${count} promjena` }),
  },
  balance: {
    title: 'Dug kroz vrijeme',
    subtitle: 'Koliko dugujete na kraju svakog mjeseca. Ispod nule duguju vama.',
  },
  movements: {
    title: 'Promjene',
    subtitle: 'Najnovije prve, s dugom nakon svake.',
    summary: (count: number) => ({ one: `${count} promjena`, few: `${count} promjene`, other: `${count} promjena` }),
    none: (amount: string) => `Još nema promjena. Zajam duguje početni iznos od ${amount}.`,
    change: (day: string) => `Uredi promjenu od ${day}`,
  },
}

export const words = language === 'hr' ? hr : en
